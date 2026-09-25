"use strict";

const request = require("supertest");
const createApp = require("../src/app");
const pool = require("../src/database/pool");
const config = require("../src/config");
const { criarLimitadoresAuth } = require("../src/middleware/limiters");
const { prepararBanco, limparUsuarios, criarUsuario } = require("./helpers");

beforeAll(prepararBanco);
beforeEach(limparUsuarios);
afterAll(() => pool.end());

// Limitadores com tetos baixos e respeitados em teste (na suite normal eles sobem para nao atrapalhar).
const appLimitado = (opcoes = {}) => createApp({ limitadores: criarLimitadoresAuth({ testar: true, ...opcoes }) });

const tentar = (app, email, headers = {}, senha = "errada-1234") =>
  request(app).post("/api/auth/login").set(headers).send({ email, password: senha });

describe("limite de tentativas de login", () => {
  test("5 falhas do mesmo IP + e-mail bloqueiam a 6a (429); acertar a senha nao gasta o limite", async () => {
    const app = appLimitado();
    const u = await criarUsuario(app, { email: "vitima@example.com" });
    for (let i = 0; i < 3; i += 1) expect((await tentar(app, u.dados.email, {}, u.dados.password)).status).toBe(200);
    const codigos = [];
    for (let i = 0; i < 7; i += 1) codigos.push((await tentar(app, u.dados.email)).status);
    expect(codigos).toEqual([401, 401, 401, 401, 401, 429, 429]);
  });

  test("cabecalhos de IP forjados NAO burlam o limite quando CLIENT_IP_HEADER nao esta configurado", async () => {
    const app = appLimitado();
    const u = await criarUsuario(app, { email: "alvo@example.com" });
    const codigos = [];
    for (let i = 0; i < 8; i += 1) {
      codigos.push((await tentar(app, u.dados.email, { "X-Forwarded-For": `10.0.0.${i}`, "CF-Connecting-IP": `10.1.0.${i}` })).status);
    }
    expect(codigos).toContain(429);
  });

  test("com CLIENT_IP_HEADER configurado, cada IP real tem o seu contador (e o teto por e-mail continua valendo)", async () => {
    const original = config.clientIpHeader;
    config.clientIpHeader = "cf-connecting-ip";
    try {
      const app = appLimitado({ emailLimite: 8 });
      const u = await criarUsuario(app, { email: "distribuido@example.com" });
      // 5 falhas de um IP bloqueiam esse IP...
      for (let i = 0; i < 5; i += 1) await tentar(app, u.dados.email, { "CF-Connecting-IP": "8.8.8.8" });
      expect((await tentar(app, u.dados.email, { "CF-Connecting-IP": "8.8.8.8" })).status).toBe(429);
      // ...mas outro IP ainda pode tentar (401), ate o teto do e-mail (8 falhas no total) ser atingido
      expect((await tentar(app, u.dados.email, { "CF-Connecting-IP": "7.7.7.7" })).status).toBe(401);
      expect((await tentar(app, u.dados.email, { "CF-Connecting-IP": "6.6.6.6" })).status).toBe(401);
      expect((await tentar(app, u.dados.email, { "CF-Connecting-IP": "5.5.5.5" })).status).toBe(401);
      // 5 (IP1) + 3 (outros) = 8: o e-mail inteiro esta bloqueado, mesmo com a senha certa
      expect((await tentar(app, u.dados.email, { "CF-Connecting-IP": "4.4.4.4" }, u.dados.password)).status).toBe(429);
    } finally {
      config.clientIpHeader = original;
    }
  });

  test("cadastro em massa do mesmo IP e' limitado", async () => {
    const app = appLimitado({ cadastroLimite: 3 });
    const codigos = [];
    for (let i = 0; i < 5; i += 1) {
      codigos.push((await request(app).post("/api/auth/register").send({ name: "Spam Bot", email: `bot${i}@example.com`, password: "senhaForte123" })).status);
    }
    expect(codigos).toEqual([201, 201, 201, 429, 429]);
  });

  test("senha errada ao excluir a conta tambem e' limitada", async () => {
    const app = appLimitado({ exclusaoLimite: 2 });
    const u = await criarUsuario(app);
    const apagar = (senha) => request(app).post("/api/users/me/delete").set(u.headers).send({ password: senha });
    expect([(await apagar("x1234567")).status, (await apagar("x1234568")).status, (await apagar("x1234569")).status]).toEqual([403, 403, 429]);
    expect((await apagar(u.dados.password)).status).toBe(429); // bloqueada mesmo com a senha certa
  });
});

describe("CORS", () => {
  test("libera so' as origens de FRONTEND_URL em producao-like e responde ao preflight", async () => {
    const app = createApp();
    const permitida = config.frontendUrls[0];
    const ok = await request(app).options("/api/categories").set("Origin", permitida).set("Access-Control-Request-Method", "GET");
    expect(ok.headers["access-control-allow-origin"]).toBe(permitida);
    const expostos = await request(app).get("/api/categories").set("Origin", permitida);
    expect(expostos.headers["access-control-expose-headers"]).toContain("Retry-After");
  });

  test("a propria origem da API passa (modulos e fontes do site servido pela API), a de terceiros nao", async () => {
    const original = config.isProduction;
    config.isProduction = true;
    try {
      const app = createApp();
      const propria = await request(app).get("/api/categories").set("Host", "api.exemplo.com").set("Origin", "https://api.exemplo.com");
      expect(propria.status).toBe(200);
      expect(propria.headers["access-control-allow-origin"]).toBe("https://api.exemplo.com");
      // um site de terceiros nao consegue se passar pela origem da API: o Origin dele nunca casa com o nosso Host
      const terceiro = await request(app).get("/api/categories").set("Host", "api.exemplo.com").set("Origin", "https://site-malicioso.example");
      expect(terceiro.status).toBe(403);
      const truque = await request(app).get("/api/categories").set("Host", "api.exemplo.com").set("Origin", "https://api.exemplo.com.site-malicioso.example");
      expect(truque.status).toBe(403);
    } finally {
      config.isProduction = original;
    }
  });

  test("origem desconhecida e' recusada (403) quando nao e' local", async () => {
    const original = config.isProduction;
    config.isProduction = true; // corsOrigin le a config a cada requisicao
    try {
      const res = await request(createApp()).get("/api/categories").set("Origin", "https://site-malicioso.example");
      expect(res.status).toBe(403);
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    } finally {
      config.isProduction = original;
    }
  });
});

describe("cabecalhos e erros", () => {
  const app = createApp();

  test("cabecalhos de seguranca do helmet e CSP restritiva", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(res.headers["content-security-policy"]).toContain("script-src 'self'");
  });

  test("rota inexistente = 404 JSON; corpo invalido = 400; corpo gigante = 413; nada vaza detalhes", async () => {
    expect((await request(app).get("/api/nao-existe")).body).toEqual({ erro: "Rota não encontrada." });
    const invalido = await request(app).post("/api/auth/login").set("Content-Type", "application/json").send("{isso nao e json");
    expect(invalido.status).toBe(400);
    const grande = await request(app).post("/api/auth/login").send({ email: "a@b.co", password: "x".repeat(200000) });
    expect(grande.status).toBe(413);
    expect(JSON.stringify(grande.body)).not.toMatch(/stack|node_modules|SELECT/i);
  });

  test("resposta de erro do banco nao vaza SQL (id fora do intervalo vira 404, nao 500)", async () => {
    const u = await criarUsuario(app);
    const res = await request(app).get("/api/results/99999999999999999999").set(u.headers);
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(/integer|SELECT|pg_/i);
  });
});
