"use strict";

const request = require("supertest");
const createApp = require("../src/app");
const pool = require("../src/database/pool");
const config = require("../src/config");
const emailService = require("../src/services/email.service");
const { criarLimitadoresAuth } = require("../src/middleware/limiters");
const { prepararBanco, limparUsuarios, criarUsuario } = require("./helpers");

const app = createApp();
const caixa = emailService.caixaDeTeste;

beforeAll(prepararBanco);
beforeEach(async () => {
  await limparUsuarios();
  caixa.length = 0;
});
afterAll(() => pool.end());

const TEMPO_MAX_MS = 3000;

/** O envio roda em segundo plano (a resposta nao espera por ele): aguarda a mensagem chegar na caixa de teste. */
async function esperarEmail(para, assunto) {
  const limite = Date.now() + TEMPO_MAX_MS;
  for (;;) {
    const achado = caixa.find((m) => m.para === para && (!assunto || m.assunto.includes(assunto)));
    if (achado) return achado;
    if (Date.now() > limite) throw new Error(`e-mail para ${para} nao chegou`);
    await new Promise((r) => setTimeout(r, 25));
  }
}

const tokenDoEmail = (msg) => {
  const m = msg.texto.match(/#token=([A-Za-z0-9_-]+)/);
  if (!m) throw new Error("link sem token");
  return m[1];
};

async function pedirLink(u) {
  const res = await request(app).post("/api/auth/forgot-password").send({ email: u.dados.email });
  expect(res.status).toBe(202);
  const msg = await esperarEmail(u.dados.email, "Redefinição");
  return { msg, token: tokenDoEmail(msg) };
}

describe("POST /api/auth/forgot-password", () => {
  test("e-mail cadastrado: responde 202 e envia o link (token no fragmento, so' o hash no banco)", async () => {
    const u = await criarUsuario(app, { name: "Maria Silva" });
    const { msg, token } = await pedirLink(u);

    expect(msg.texto).toContain(`${config.appUrl}/redefinir-senha.html#token=${token}`);
    expect(msg.html).toContain("Escolher nova senha");
    expect(token.length).toBeGreaterThanOrEqual(40);

    const { rows } = await pool.query("SELECT token_hash, expira_em, usado_em FROM senha_resets");
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].token_hash).not.toContain(token);
    expect(rows[0].usado_em).toBeNull();
    const minutos = (new Date(rows[0].expira_em) - Date.now()) / 60000;
    expect(minutos).toBeGreaterThan(config.resetMinutos - 2);
    expect(minutos).toBeLessThanOrEqual(config.resetMinutos);
  });

  test("e-mail inexistente: mesma resposta, nenhum e-mail e nenhum registro (nao revela quem tem conta)", async () => {
    const u = await criarUsuario(app);
    const existente = await request(app).post("/api/auth/forgot-password").send({ email: u.dados.email });
    const inexistente = await request(app).post("/api/auth/forgot-password").send({ email: "ninguem@example.com" });
    expect(inexistente.status).toBe(existente.status);
    expect(inexistente.body).toEqual(existente.body);
    await esperarEmail(u.dados.email);
    await new Promise((r) => setTimeout(r, 150));
    expect(caixa.filter((m) => m.para === "ninguem@example.com")).toHaveLength(0);
    expect((await pool.query("SELECT COUNT(*)::int AS n FROM senha_resets")).rows[0].n).toBe(1);
  });

  test("ignora maiusculas no e-mail e valida o formato (422)", async () => {
    const u = await criarUsuario(app, { email: "Pessoa.Teste@Example.com" });
    expect((await request(app).post("/api/auth/forgot-password").send({ email: "PESSOA.TESTE@EXAMPLE.COM" })).status).toBe(202);
    await esperarEmail(u.dados.email.toLowerCase());
    for (const corpo of [{}, { email: "" }, { email: "sem-arroba" }, { email: 123 }]) {
      expect((await request(app).post("/api/auth/forgot-password").send(corpo)).status).toBe(422);
    }
  });

  test("o nome do usuario entra escapado no HTML do e-mail", async () => {
    const u = await criarUsuario(app, { name: "<script>alert(1)</script> Ana" });
    await pedirLink(u);
    const msg = caixa.find((m) => m.para === u.dados.email);
    expect(msg.html).not.toContain("<script>");
  });

  test("um novo pedido invalida o link anterior", async () => {
    const u = await criarUsuario(app);
    const primeiro = await pedirLink(u);
    caixa.length = 0;
    const segundo = await pedirLink(u);
    expect(segundo.token).not.toBe(primeiro.token);
    const velho = await request(app).post("/api/auth/reset-password").send({ token: primeiro.token, password: "NovaSenha!2024" });
    expect(velho.status).toBe(400);
    const novo = await request(app).post("/api/auth/reset-password").send({ token: segundo.token, password: "NovaSenha!2024" });
    expect(novo.status).toBe(200);
  });

  test("limite por e-mail: nao da' para encher a caixa de alguem (429)", async () => {
    const limitado = createApp({ limitadores: criarLimitadoresAuth({ testar: true, esqueciEmailLimite: 2, esqueciIpLimite: 100 }) });
    const u = await criarUsuario(app);
    for (let i = 0; i < 2; i += 1) {
      expect((await request(limitado).post("/api/auth/forgot-password").send({ email: u.dados.email })).status).toBe(202);
    }
    const terceiro = await request(limitado).post("/api/auth/forgot-password").send({ email: u.dados.email });
    expect(terceiro.status).toBe(429);
    // Outro e-mail, mesmo IP: segue liberado (o teto por e-mail e' independente).
    expect((await request(limitado).post("/api/auth/forgot-password").send({ email: "outro@example.com" })).status).toBe(202);
  });

  test("limite por IP: 429 depois do teto", async () => {
    const limitado = createApp({ limitadores: criarLimitadoresAuth({ testar: true, esqueciIpLimite: 3, esqueciEmailLimite: 100 }) });
    for (let i = 0; i < 3; i += 1) {
      expect((await request(limitado).post("/api/auth/forgot-password").send({ email: `alguem${i}@example.com` })).status).toBe(202);
    }
    expect((await request(limitado).post("/api/auth/forgot-password").send({ email: "alguem9@example.com" })).status).toBe(429);
  });
});

describe("POST /api/auth/reset-password", () => {
  test("troca a senha: a antiga para de valer, a nova entra, sessoes abertas caem e chega o aviso", async () => {
    const u = await criarUsuario(app, { password: "senhaAntiga123" });
    const { token } = await pedirLink(u);

    const res = await request(app).post("/api/auth/reset-password").send({ token, password: "SenhaNova!456" });
    expect(res.status).toBe(200);
    expect(res.body.mensagem).toMatch(/Senha alterada/);

    expect((await request(app).post("/api/auth/login").send({ email: u.dados.email, password: "senhaAntiga123" })).status).toBe(401);
    expect((await request(app).post("/api/auth/login").send({ email: u.dados.email, password: "SenhaNova!456" })).status).toBe(200);
    // O token de login emitido antes da troca deixa de valer (token_version).
    expect((await request(app).get("/api/users/me").set(u.headers)).status).toBe(401);
    await esperarEmail(u.dados.email, "senha foi alterada");
    const { rows } = await pool.query("SELECT senha_hash FROM usuarios WHERE email = $1", [u.dados.email]);
    expect(rows[0].senha_hash).toMatch(/^\$2[aby]\$/);
  });

  test("o link so' vale uma vez", async () => {
    const u = await criarUsuario(app);
    const { token } = await pedirLink(u);
    expect((await request(app).post("/api/auth/reset-password").send({ token, password: "SenhaNova!456" })).status).toBe(200);
    const de_novo = await request(app).post("/api/auth/reset-password").send({ token, password: "OutraSenha!789" });
    expect(de_novo.status).toBe(400);
    expect(de_novo.body.erro).toMatch(/inválido|venceu/);
    expect((await request(app).post("/api/auth/login").send({ email: u.dados.email, password: "OutraSenha!789" })).status).toBe(401);
  });

  test("link vencido nao funciona", async () => {
    const u = await criarUsuario(app);
    const { token } = await pedirLink(u);
    await pool.query("UPDATE senha_resets SET expira_em = now() - interval '1 minute'");
    const res = await request(app).post("/api/auth/reset-password").send({ token, password: "SenhaNova!456" });
    expect(res.status).toBe(400);
    expect((await request(app).post("/api/auth/login").send({ email: u.dados.email, password: u.dados.password })).status).toBe(200);
  });

  test("token inventado ou malformado: 400 / 422, sem detalhe", async () => {
    await criarUsuario(app);
    const falso = "a".repeat(43);
    expect((await request(app).post("/api/auth/reset-password").send({ token: falso, password: "SenhaNova!456" })).status).toBe(400);
    for (const token of ["curto", "com espaco e simbolos!!!!!!!!!!", 123, null, undefined, "x".repeat(200)]) {
      const r = await request(app).post("/api/auth/reset-password").send({ token, password: "SenhaNova!456" });
      expect(r.status).toBe(422);
    }
  });

  test("senha fraca e' recusada (422) e o link continua valido para tentar de novo", async () => {
    const u = await criarUsuario(app);
    const { token } = await pedirLink(u);
    for (const password of ["curta", "12345678", "", undefined]) {
      expect((await request(app).post("/api/auth/reset-password").send({ token, password })).status).toBe(422);
    }
    expect((await request(app).post("/api/auth/reset-password").send({ token, password: "SenhaBoa!456" })).status).toBe(200);
  });

  test("limite de tentativas com link invalido (429)", async () => {
    const limitado = createApp({ limitadores: criarLimitadoresAuth({ testar: true, redefinicaoLimite: 3 }) });
    const falso = "b".repeat(43);
    for (let i = 0; i < 3; i += 1) {
      expect((await request(limitado).post("/api/auth/reset-password").send({ token: falso, password: "SenhaNova!456" })).status).toBe(400);
    }
    expect((await request(limitado).post("/api/auth/reset-password").send({ token: falso, password: "SenhaNova!456" })).status).toBe(429);
  });

  test("excluir a conta apaga os pedidos de redefinicao (cascata)", async () => {
    const u = await criarUsuario(app);
    await pedirLink(u);
    const del = await request(app).post("/api/users/me/delete").set(u.headers).send({ password: u.dados.password });
    expect(del.status).toBe(204);
    expect((await pool.query("SELECT COUNT(*)::int AS n FROM senha_resets")).rows[0].n).toBe(0);
  });
});

describe("GET /api/config", () => {
  test("informa se a recuperacao de senha esta disponivel (publico, sem segredos)", async () => {
    const res = await request(app).get("/api/config");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ password_reset: true }); // em teste o e-mail e' simulado
    expect(JSON.stringify(res.body)).not.toMatch(/smtp|host|secret|"user/i);
  });
});
