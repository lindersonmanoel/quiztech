"use strict";

const request = require("supertest");
const createApp = require("../src/app");
const pool = require("../src/database/pool");
const config = require("../src/config");
const { prepararBanco, limparUsuarios, criarUsuario, quizIdDaArea, gabarito } = require("./helpers");

const app = createApp();

beforeAll(prepararBanco);
beforeEach(limparUsuarios);
afterAll(async () => {
  await pool.query("DELETE FROM categorias WHERE slug LIKE 'teste-%'");
  await pool.end();
});

const admin = () => criarUsuario(app, { name: "Administrador", email: config.adminEmail });

describe("controle de acesso", () => {
  test("anonimo = 401; usuario comum = 403; administrador = 200", async () => {
    expect((await request(app).get("/api/admin/stats")).status).toBe(401);
    const comum = await criarUsuario(app);
    expect((await request(app).get("/api/admin/stats").set(comum.headers)).status).toBe(403);
    const adm = await admin();
    const res = await request(app).get("/api/admin/stats").set(adm.headers);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ users: 2, categories: 32, quizzes: 32, questions: 192, results: 0, certificates: 0 });
  });

  test("usuario comum nao consegue criar nada (todas as rotas de escrita)", async () => {
    const comum = await criarUsuario(app);
    const chamadas = [
      request(app).post("/api/admin/categories").set(comum.headers).send({}),
      request(app).post("/api/admin/quizzes").set(comum.headers).send({}),
      request(app).post("/api/admin/questions").set(comum.headers).send({}),
      request(app).delete("/api/admin/quizzes/1").set(comum.headers),
      request(app).delete("/api/admin/categories/1").set(comum.headers),
      request(app).delete("/api/admin/questions/1").set(comum.headers),
    ];
    for (const r of await Promise.all(chamadas)) expect(r.status).toBe(403);
  });
});

describe("categorias, quizzes e perguntas", () => {
  test("cria categoria, quiz e pergunta; o quiz novo aparece para os jogadores sem gabarito", async () => {
    const adm = await admin();
    const cat = await request(app).post("/api/admin/categories").set(adm.headers)
      .send({ name: "Teste Área", slug: "teste-area", group: "Testes", icon: "🧪", description: "Só para teste" });
    expect(cat.status).toBe(201);
    const quiz = await request(app).post("/api/admin/quizzes").set(adm.headers)
      .send({ title: "Quiz de teste", category_id: cat.body.id, difficulty: "facil", time_limit: 60 });
    expect(quiz.status).toBe(201);
    expect(quiz.body).toMatchObject({ title: "Quiz de teste", question_count: 0, difficulty: "facil" });

    const p = await request(app).post("/api/admin/questions").set(adm.headers).send({
      quiz_id: quiz.body.id, text: "Pergunta válida?", points: 10,
      alternatives: [{ text: "A", is_correct: true }, { text: "B" }, { text: "C" }],
    });
    expect(p.status).toBe(201);
    const publico = (await request(app).get(`/api/quizzes/${quiz.body.id}`)).body;
    expect(publico.questions).toHaveLength(1);
    expect(JSON.stringify(publico)).not.toMatch(/is_correct|correta/);
  });

  test("pergunta exige exatamente 1 alternativa correta", async () => {
    const adm = await admin();
    const id = await quizIdDaArea("python");
    const base = { quiz_id: id, text: "Pergunta inválida?", points: 10 };
    const duas = await request(app).post("/api/admin/questions").set(adm.headers)
      .send({ ...base, alternatives: [{ text: "A", is_correct: true }, { text: "B", is_correct: true }] });
    const nenhuma = await request(app).post("/api/admin/questions").set(adm.headers)
      .send({ ...base, alternatives: [{ text: "A" }, { text: "B" }] });
    const uma = await request(app).post("/api/admin/questions").set(adm.headers)
      .send({ ...base, alternatives: [{ text: "A" }] });
    expect([duas.status, nenhuma.status, uma.status]).toEqual([422, 422, 422]);
    expect((await request(app).get(`/api/quizzes/${id}`)).body.questions).toHaveLength(6);
  });

  test("validacao de categoria e quiz (slug, dificuldade, tempo)", async () => {
    const adm = await admin();
    const ruim = await request(app).post("/api/admin/categories").set(adm.headers).send({ name: "x", slug: "Slug Inválido", group: "" });
    expect(ruim.status).toBe(422);
    expect(Object.keys(ruim.body.campos).sort()).toEqual(["group", "name", "slug"]);
    const q = await request(app).post("/api/admin/quizzes").set(adm.headers).send({ title: "Quiz", category_id: 1, difficulty: "impossivel", time_limit: -5 });
    expect(q.status).toBe(422);
    expect(q.body.campos).toHaveProperty("difficulty");
    expect(q.body.campos).toHaveProperty("time_limit");
    expect((await request(app).post("/api/admin/quizzes").set(adm.headers).send({ title: "Quiz", category_id: 999999 })).status).toBe(404);
  });

  test("categoria duplicada = 409; slug em uso tambem", async () => {
    const adm = await admin();
    const corpo = { name: "Teste Dup", slug: "teste-dup", group: "Testes" };
    expect((await request(app).post("/api/admin/categories").set(adm.headers).send(corpo)).status).toBe(201);
    expect((await request(app).post("/api/admin/categories").set(adm.headers).send(corpo)).status).toBe(409);
  });

  test("quiz com historico e' desativado (nao apagado); sem historico e' apagado", async () => {
    const adm = await admin();
    const jogador = await criarUsuario(app);
    const id = await quizIdDaArea("python");
    await request(app).post(`/api/quizzes/${id}/submit`).set(jogador.headers).send({ answers: await gabarito(id) });

    expect((await request(app).delete(`/api/admin/quizzes/${id}`).set(adm.headers)).status).toBe(204);
    expect((await request(app).get(`/api/quizzes/${id}`)).status).toBe(404); // inativo
    const { rows } = await pool.query("SELECT ativo FROM quizzes WHERE id = $1", [id]);
    expect(rows[0].ativo).toBe(false);
    expect((await request(app).get("/api/certificates").set(jogador.headers)).body).toHaveLength(1); // certificado preservado
    await pool.query("UPDATE quizzes SET ativo = true WHERE id = $1", [id]);

    const cat = await request(app).post("/api/admin/categories").set(adm.headers).send({ name: "Teste Apagar", slug: "teste-apagar", group: "Testes" });
    const novo = await request(app).post("/api/admin/quizzes").set(adm.headers).send({ title: "Apagável", category_id: cat.body.id });
    expect((await request(app).delete(`/api/admin/quizzes/${novo.body.id}`).set(adm.headers)).status).toBe(204);
    expect((await pool.query("SELECT 1 FROM quizzes WHERE id = $1", [novo.body.id])).rowCount).toBe(0);
  });

  test("categoria com resultados nao pode ser excluida (409); sem resultados pode", async () => {
    const adm = await admin();
    const jogador = await criarUsuario(app);
    const id = await quizIdDaArea("python");
    await request(app).post(`/api/quizzes/${id}/submit`).set(jogador.headers).send({ answers: [] });
    const cats = (await request(app).get("/api/categories")).body;
    const python = cats.find((c) => c.slug === "python");
    expect((await request(app).delete(`/api/admin/categories/${python.id}`).set(adm.headers)).status).toBe(409);

    const nova = await request(app).post("/api/admin/categories").set(adm.headers).send({ name: "Teste Vazia", slug: "teste-vazia", group: "Testes" });
    expect((await request(app).delete(`/api/admin/categories/${nova.body.id}`).set(adm.headers)).status).toBe(204);
    expect((await request(app).delete("/api/admin/categories/999999").set(adm.headers)).status).toBe(404);
  });

  test("excluir pergunta remove suas alternativas", async () => {
    const adm = await admin();
    const cat = await request(app).post("/api/admin/categories").set(adm.headers).send({ name: "Teste Perg", slug: "teste-perg", group: "Testes" });
    const quiz = await request(app).post("/api/admin/quizzes").set(adm.headers).send({ title: "Com pergunta", category_id: cat.body.id });
    const p = await request(app).post("/api/admin/questions").set(adm.headers).send({
      quiz_id: quiz.body.id, text: "Pergunta?", alternatives: [{ text: "A", is_correct: true }, { text: "B" }],
    });
    expect((await request(app).delete(`/api/admin/questions/${p.body.id}`).set(adm.headers)).status).toBe(204);
    expect((await pool.query("SELECT 1 FROM alternativas WHERE pergunta_id = $1", [p.body.id])).rowCount).toBe(0);
    expect((await request(app).delete(`/api/admin/questions/${p.body.id}`).set(adm.headers)).status).toBe(404);
  });
});
