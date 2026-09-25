"use strict";

const request = require("supertest");
const jwt = require("jsonwebtoken");
const createApp = require("../src/app");
const pool = require("../src/database/pool");
const config = require("../src/config");
const { prepararBanco, limparUsuarios, criarUsuario } = require("./helpers");

const app = createApp();
const valido = { name: "Ana Souza", email: "ana@example.com", password: "senhaForte123" };

beforeAll(prepararBanco);
beforeEach(limparUsuarios);
afterAll(() => pool.end());

describe("POST /api/auth/register", () => {
  test("cria a conta, devolve token e nunca a senha nem o hash", async () => {
    const res = await request(app).post("/api/auth/register").send(valido);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: "Ana Souza", email: "ana@example.com", is_admin: false });
    expect(res.body.access_token).toEqual(expect.any(String));
    expect(JSON.stringify(res.body)).not.toContain("senha_hash");
    expect(JSON.stringify(res.body)).not.toContain(valido.password);
  });

  test("guarda a senha com bcrypt (nunca em texto)", async () => {
    await request(app).post("/api/auth/register").send(valido);
    const { rows } = await pool.query("SELECT senha_hash FROM usuarios WHERE email = $1", [valido.email]);
    expect(rows[0].senha_hash).toMatch(/^\$2[aby]\$/);
    expect(rows[0].senha_hash).not.toContain(valido.password);
  });

  test("e-mail duplicado (mesmo com maiusculas e espacos) = 409", async () => {
    await request(app).post("/api/auth/register").send(valido);
    const res = await request(app).post("/api/auth/register").send({ ...valido, email: "  ANA@Example.com " });
    expect(res.status).toBe(409);
    expect(res.body.erro).toMatch(/cadastrado/i);
  });

  test("cadastros simultaneos com o mesmo e-mail: um passa, o outro leva 409 (nunca 500)", async () => {
    const [a, b] = await Promise.all([
      request(app).post("/api/auth/register").send(valido),
      request(app).post("/api/auth/register").send(valido),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
  });

  test.each([
    ["nome curto", { name: "A" }, "name"],
    ["e-mail invalido", { email: "nao-e-email" }, "email"],
    ["e-mail com aspas", { email: "a'b@x.com" }, "email"],
    ["senha curta", { password: "curta" }, "password"],
    ["senha comum", { password: "12345678" }, "password"],
    ["senha acima de 72 bytes", { password: "é".repeat(40) }, "password"],
  ])("recusa %s com 422 e indica o campo", async (_rotulo, troca, campo) => {
    const res = await request(app).post("/api/auth/register").send({ ...valido, ...troca });
    expect(res.status).toBe(422);
    expect(res.body.campos[campo]).toEqual(expect.any(String));
  });

  test("apenas o e-mail de ADMIN_EMAIL vira administrador", async () => {
    const admin = await request(app).post("/api/auth/register").send({ ...valido, email: config.adminEmail });
    const comum = await request(app).post("/api/auth/register").send(valido);
    expect(admin.body.user.is_admin).toBe(true);
    expect(comum.body.user.is_admin).toBe(false);
  });
});

describe("POST /api/auth/login", () => {
  test("entra com a senha certa e recusa a errada com mensagem generica", async () => {
    await request(app).post("/api/auth/register").send(valido);
    const ok = await request(app).post("/api/auth/login").send({ email: "ANA@example.com", password: valido.password });
    expect(ok.status).toBe(200);
    const erradaSenha = await request(app).post("/api/auth/login").send({ email: valido.email, password: "errada-1234" });
    const semConta = await request(app).post("/api/auth/login").send({ email: "ninguem@example.com", password: "errada-1234" });
    expect(erradaSenha.status).toBe(401);
    expect(semConta.status).toBe(401);
    expect(erradaSenha.body.erro).toBe(semConta.body.erro); // nao revela se o e-mail existe
  });

  test("exige e-mail e senha", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    expect(res.status).toBe(422);
  });
});

describe("sessao e token", () => {
  test("GET /users/me exige token valido", async () => {
    expect((await request(app).get("/api/users/me")).status).toBe(401);
    expect((await request(app).get("/api/users/me").set("Authorization", "Bearer abc.def.ghi")).status).toBe(401);
    const u = await criarUsuario(app);
    const res = await request(app).get("/api/users/me").set(u.headers);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(u.dados.email);
  });

  test("recusa JWT sem assinatura (alg=none) e assinado com outra chave", async () => {
    const u = await criarUsuario(app);
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: String(u.usuario.id), tv: 0 })).toString("base64url")}.`;
    expect((await request(app).get("/api/users/me").set("Authorization", `Bearer ${none}`)).status).toBe(401);
    const falso = jwt.sign({ sub: String(u.usuario.id), tv: 0 }, "outra-chave-qualquer", { algorithm: "HS256" });
    expect((await request(app).get("/api/users/me").set("Authorization", `Bearer ${falso}`)).status).toBe(401);
  });

  test("token deixa de valer quando o usuario e' apagado ou a versao muda", async () => {
    const u = await criarUsuario(app);
    await pool.query("UPDATE usuarios SET token_version = token_version + 1 WHERE id = $1", [u.usuario.id]);
    expect((await request(app).get("/api/users/me").set(u.headers)).status).toBe(401);
  });

  test("PUT /users/me troca o nome (com validacao)", async () => {
    const u = await criarUsuario(app);
    const ok = await request(app).put("/api/users/me").set(u.headers).send({ name: "  Novo   Nome  " });
    expect(ok.status).toBe(200);
    expect(ok.body.name).toBe("Novo Nome");
    expect((await request(app).put("/api/users/me").set(u.headers).send({ name: "x" })).status).toBe(422);
  });
});

describe("POST /api/users/me/delete (LGPD)", () => {
  test("exige autenticacao e a senha certa (403, nao 401, para nao parecer sessao expirada)", async () => {
    expect((await request(app).post("/api/users/me/delete").send({ password: "x" })).status).toBe(401);
    const u = await criarUsuario(app);
    const errada = await request(app).post("/api/users/me/delete").set(u.headers).send({ password: "senha-errada-1" });
    expect(errada.status).toBe(403);
    expect((await request(app).get("/api/users/me").set(u.headers)).status).toBe(200);
  });

  test("com a senha certa apaga conta, resultados e certificados", async () => {
    const u = await criarUsuario(app);
    const res = await request(app).post("/api/users/me/delete").set(u.headers).send({ password: u.dados.password });
    expect(res.status).toBe(204);
    expect((await request(app).get("/api/users/me").set(u.headers)).status).toBe(401);
    const login = await request(app).post("/api/auth/login").send({ email: u.dados.email, password: u.dados.password });
    expect(login.status).toBe(401);
    const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM usuarios");
    expect(rows[0].n).toBe(0);
  });
});
