"use strict";

const request = require("supertest");
const createApp = require("../src/app");
const pool = require("../src/database/pool");
const PgStore = require("../src/middleware/pgStore");
const { criarLimitadoresAuth } = require("../src/middleware/limiters");
const { emSegundoPlano } = require("../src/utils/segundoPlano");
const { prepararBanco, limparUsuarios, criarUsuario } = require("./helpers");

beforeAll(prepararBanco);
beforeEach(async () => {
  await limparUsuarios();
  await pool.query("TRUNCATE rate_limits");
});
afterAll(() => pool.end());

const chave = (n = "a") => n.padEnd(64, "0");
const novoStore = (janelaMs = 60000) => {
  const s = new PgStore();
  s.init({ windowMs: janelaMs });
  return s;
};

describe("PgStore (contadores no PostgreSQL)", () => {
  test("conta a partir de 1 e mantem o fim da janela", async () => {
    const s = novoStore();
    const a = await s.increment(chave());
    const b = await s.increment(chave());
    const c = await s.increment(chave());
    expect([a.totalHits, b.totalHits, c.totalHits]).toEqual([1, 2, 3]);
    expect(b.resetTime.getTime()).toBe(a.resetTime.getTime()); // a janela nao "escorrega" a cada hit
    expect(a.resetTime.getTime() - Date.now()).toBeGreaterThan(55000);
    expect(a.resetTime.getTime() - Date.now()).toBeLessThanOrEqual(60500);
  });

  test("chaves diferentes tem contadores independentes", async () => {
    const s = novoStore();
    await s.increment(chave("x"));
    await s.increment(chave("x"));
    expect((await s.increment(chave("y"))).totalHits).toBe(1);
  });

  test("janela vencida recomeca em 1 com novo prazo", async () => {
    const s = novoStore();
    await s.increment(chave());
    await s.increment(chave());
    await pool.query("UPDATE rate_limits SET expira_em = now() - interval '1 second'");
    const depois = await s.increment(chave());
    expect(depois.totalHits).toBe(1);
    expect(depois.resetTime.getTime()).toBeGreaterThan(Date.now());
  });

  test("decrement desconta sem ficar negativo; resetKey apaga", async () => {
    const s = novoStore();
    await s.increment(chave());
    await s.increment(chave());
    await s.decrement(chave());
    expect((await s.increment(chave())).totalHits).toBe(2);
    await s.decrement(chave("nunca-usada"));
    for (let i = 0; i < 5; i += 1) await s.decrement(chave());
    expect((await pool.query("SELECT hits FROM rate_limits WHERE chave = $1", [chave()])).rows[0].hits).toBe(0);
    await s.resetKey(chave());
    expect((await pool.query("SELECT COUNT(*)::int AS n FROM rate_limits")).rows[0].n).toBe(0);
  });

  test("20 incrementos simultaneos nao perdem contagem (atomico)", async () => {
    const s = novoStore();
    const resultados = await Promise.all(Array.from({ length: 20 }, () => s.increment(chave())));
    expect(resultados.map((r) => r.totalHits).sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  test("se o banco falhar, deixa passar (falha aberta) e registra o erro", async () => {
    const espiao = jest.spyOn(console, "error").mockImplementation(() => {});
    const s = new PgStore({ banco: { query: () => Promise.reject(new Error("banco fora")) } });
    s.init({ windowMs: 1000 });
    const r = await s.increment(chave());
    expect(r.totalHits).toBe(1);
    await expect(s.decrement(chave())).resolves.toBeUndefined();
    await expect(s.resetKey(chave())).resolves.toBeUndefined();
    expect(espiao).toHaveBeenCalled();
    espiao.mockRestore();
  });

  test("a chave nao guarda IP nem e-mail: so' o hash de 64 caracteres", async () => {
    const limitado = createApp({ limitadores: criarLimitadoresAuth({ testar: true, armazenamento: "postgres" }) });
    await request(limitado).post("/api/auth/login").send({ email: "alguem@example.com", password: "qualquer" });
    const { rows } = await pool.query("SELECT chave FROM rate_limits");
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.chave).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(rows)).not.toContain("alguem@example.com");
  });
});

describe("limite de login com contadores no banco (varias instancias)", () => {
  const opcoes = { testar: true, armazenamento: "postgres", ipLimite: 3, emailLimite: 100 };

  test("bloqueia depois de 3 falhas E vale para outra instancia da API (contador compartilhado)", async () => {
    const instanciaA = createApp({ limitadores: criarLimitadoresAuth(opcoes) });
    const instanciaB = createApp({ limitadores: criarLimitadoresAuth(opcoes) }); // outra "funcao" do Vercel
    const u = await criarUsuario(instanciaA);
    const errado = { email: u.dados.email, password: "senhaErrada999" };

    for (let i = 0; i < 3; i += 1) {
      expect((await request(instanciaA).post("/api/auth/login").send(errado)).status).toBe(401);
    }
    const quarta = await request(instanciaB).post("/api/auth/login").send(errado);
    expect(quarta.status).toBe(429); // a instancia B enxerga as falhas feitas na A
    // Nem a senha CERTA entra enquanto estiver bloqueado.
    expect((await request(instanciaB).post("/api/auth/login").send({ email: u.dados.email, password: u.dados.password })).status).toBe(429);
  });

  test("login correto nao gasta o limite (skipSuccessfulRequests continua valendo)", async () => {
    const app = createApp({ limitadores: criarLimitadoresAuth(opcoes) });
    const u = await criarUsuario(app);
    for (let i = 0; i < 6; i += 1) {
      expect((await request(app).post("/api/auth/login").send({ email: u.dados.email, password: u.dados.password })).status).toBe(200);
    }
  });

  test("padrao fora do Vercel: memoria; RATE_LIMIT_STORE=postgres liga o banco", () => {
    const config = require("../src/config");
    expect(config.rateLimitStore).toBe("memory");
  });
});

describe("emSegundoPlano", () => {
  test("devolve a promessa, nao propaga erro e registra a falha", async () => {
    const espiao = jest.spyOn(console, "error").mockImplementation(() => {});
    await expect(emSegundoPlano(Promise.reject(new Error("boom")), "teste")).resolves.toBeUndefined();
    expect(espiao.mock.calls[0][0]).toContain("[teste]");
    espiao.mockRestore();
    await expect(emSegundoPlano(Promise.resolve(7))).resolves.toBe(7);
  });

  test("no Vercel avisa a plataforma (waitUntil) para esperar a tarefa terminar", async () => {
    jest.resetModules();
    const chamadas = [];
    jest.doMock("@vercel/functions", () => ({ waitUntil: (p) => chamadas.push(p) }), { virtual: false });
    process.env.VERCEL = "1";
    try {
      const { emSegundoPlano: comVercel } = require("../src/utils/segundoPlano");
      const p = comVercel(Promise.resolve("ok"));
      expect(chamadas).toHaveLength(1);
      await expect(chamadas[0]).resolves.toBeUndefined().catch(() => {});
      await p;
    } finally {
      delete process.env.VERCEL;
      jest.dontMock("@vercel/functions");
    }
  });
});
