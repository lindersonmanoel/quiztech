"use strict";

const request = require("supertest");
const createApp = require("../src/app");
const pool = require("../src/database/pool");
const { prepararBanco, limparUsuarios, criarUsuario, quizIdDaArea, gabarito, semEspera } = require("./helpers");

const app = createApp();

beforeAll(prepararBanco);
beforeEach(limparUsuarios);
afterAll(() => pool.end());

async function aprovar(u, slug = "python") {
  const id = await quizIdDaArea(slug);
  const res = await request(app).post(`/api/quizzes/${id}/submit`).set(u.headers).send({ answers: await gabarito(id) });
  return res.body;
}

describe("certificados", () => {
  test("consulta publica por codigo (sem login, sem e-mail, ignora caixa)", async () => {
    const u = await criarUsuario(app, { name: "Ana Souza Lima" });
    const r = await aprovar(u);
    const publico = await request(app).get(`/api/certificates/${r.certificate.code.toLowerCase()}`);
    expect(publico.status).toBe(200);
    expect(Object.keys(publico.body).sort()).toEqual(["category_name", "code", "difficulty", "issued_at", "percentage", "quiz_id", "quiz_title", "score", "user_name"]);
    expect(publico.body.user_name).toBe("Ana Souza Lima");
    expect(JSON.stringify(publico.body)).not.toContain(u.dados.email);
    expect((await request(app).get("/api/certificates/QT-NAOEXISTE")).status).toBe(404);
  });

  test("meus certificados exige login e lista so' os do usuario", async () => {
    expect((await request(app).get("/api/certificates")).status).toBe(401);
    const a = await criarUsuario(app);
    const b = await criarUsuario(app);
    await aprovar(a, "python");
    await aprovar(a, "javascript");
    await aprovar(b, "python");
    expect((await request(app).get("/api/certificates").set(a.headers)).body).toHaveLength(2);
    expect((await request(app).get("/api/certificates").set(b.headers)).body).toHaveLength(1);
  });

  test("o banco impede 2 certificados do mesmo usuario no mesmo quiz", async () => {
    const u = await criarUsuario(app);
    const r = await aprovar(u);
    const { rows } = await pool.query("SELECT * FROM certificados");
    await expect(
      pool.query(
        "INSERT INTO certificados (codigo, usuario_id, quiz_id, resultado_id, pontos, percentual) VALUES ('QT-DUPLICADO-0000', $1, $2, $3, 1, 1)",
        [rows[0].usuario_id, rows[0].quiz_id, r.id]
      )
    ).rejects.toMatchObject({ code: "23505" });
  });

  test("envios simultaneos aprovados emitem um unico certificado", async () => {
    const u = await criarUsuario(app);
    const id = await quizIdDaArea("python");
    const answers = await gabarito(id);
    const respostas = await Promise.all(
      Array.from({ length: 4 }, () => request(app).post(`/api/quizzes/${id}/submit`).set(u.headers).send({ answers }))
    );
    expect(respostas.every((r) => r.status === 201)).toBe(true);
    expect(new Set(respostas.map((r) => r.body.certificate.code)).size).toBe(1);
    expect((await pool.query("SELECT COUNT(*)::int AS n FROM certificados")).rows[0].n).toBe(1);
  });
});

describe("resultados", () => {
  test("cada usuario so' le os proprios resultados (IDOR = 404)", async () => {
    const a = await criarUsuario(app);
    const b = await criarUsuario(app);
    const r = await aprovar(a);
    expect((await request(app).get(`/api/results/${r.id}`).set(a.headers)).status).toBe(200);
    expect((await request(app).get(`/api/results/${r.id}`).set(b.headers)).status).toBe(404);
    expect((await request(app).get("/api/results").set(b.headers)).body).toEqual([]);
    expect((await request(app).get("/api/results")).status).toBe(401);
  });

  test("historico traz aprovacao e ordem do mais recente", async () => {
    const u = await criarUsuario(app);
    const id = await quizIdDaArea("python");
    await request(app).post(`/api/quizzes/${id}/submit`).set(u.headers).send({ answers: [] });
    await semEspera(u.usuario.id);
    await aprovar(u);
    const lista = (await request(app).get("/api/results").set(u.headers)).body;
    expect(lista.map((r) => r.passed)).toEqual([true, false]);
  });
});

describe("ranking", () => {
  test("mostra so' 'Primeiro nome + inicial' e soma a melhor nota por quiz", async () => {
    const a = await criarUsuario(app, { name: "Linderson Manoel Brito Venancio" });
    const b = await criarUsuario(app, { name: "Ana Souza" });
    await aprovar(a, "python");
    await aprovar(a, "python"); // refazer nao infla
    await aprovar(a, "javascript");
    await aprovar(b, "python");
    const rk = (await request(app).get("/api/ranking")).body;
    expect(rk).toEqual([
      { position: 1, user_name: "Linderson V.", total_score: 240, quizzes_completed: 2 },
      { position: 2, user_name: "Ana S.", total_score: 120, quizzes_completed: 1 },
    ]);
  });

  test("filtra por area e por quiz; parametros invalidos = 422", async () => {
    const a = await criarUsuario(app, { name: "Ana Souza" });
    await aprovar(a, "python");
    const cats = (await request(app).get("/api/categories")).body;
    const python = cats.find((c) => c.slug === "python");
    const js = cats.find((c) => c.slug === "javascript");
    expect((await request(app).get("/api/ranking").query({ category_id: python.id })).body).toHaveLength(1);
    expect((await request(app).get("/api/ranking").query({ category_id: js.id })).body).toEqual([]);
    expect((await request(app).get("/api/ranking").query({ limit: "x" })).status).toBe(422);
  });
});
