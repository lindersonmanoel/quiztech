"use strict";

const request = require("supertest");
const createApp = require("../src/app");
const pool = require("../src/database/pool");
const config = require("../src/config");
const { prepararBanco, limparUsuarios, criarUsuario, quizIdDaArea, gabarito, respostasErradas } = require("./helpers");

const app = createApp();

beforeAll(prepararBanco);
beforeEach(limparUsuarios);
afterAll(async () => {
  await limparUsuarios(); // os resultados dos quizzes de teste saem antes (FK RESTRICT)
  await pool.query("DELETE FROM categorias WHERE slug LIKE 'teste-%'");
  await pool.end();
});

const admin = () => criarUsuario(app, { name: "Administrador", email: config.adminEmail });

let seq = 0;

/** Cria uma area + um quiz descartaveis: o catalogo real nunca e' alterado pelos testes (o banco e' compartilhado entre as suites). */
async function quizDeTeste(adm, { dificuldade = "facil", perguntas = 3 } = {}) {
  seq += 1;
  const sufixo = `${Date.now()}-${seq}`;
  const cat = await request(app).post("/api/admin/categories").set(adm.headers)
    .send({ name: `Teste Painel ${sufixo}`, slug: `teste-painel-${sufixo}`, group: "Testes", icon: "code", description: "descartavel" });
  expect(cat.status).toBe(201);
  const quiz = await request(app).post("/api/admin/quizzes").set(adm.headers)
    .send({ title: `Quiz descartavel ${sufixo}`, category_id: cat.body.id, difficulty: dificuldade, time_limit: 0 });
  expect(quiz.status).toBe(201);
  for (let i = 0; i < perguntas; i += 1) {
    const p = await request(app).post("/api/admin/questions").set(adm.headers).send({
      quiz_id: quiz.body.id, text: `Pergunta ${i + 1} do teste?`, points: 10,
      alternatives: [{ text: "Certa", is_correct: true }, { text: "Errada 1" }, { text: "Errada 2" }, { text: "Errada 3" }],
    });
    expect(p.status).toBe(201);
  }
  return { categoriaId: cat.body.id, quizId: quiz.body.id };
}

const doCatalogo = (lista) => lista.filter((q) => !q.category_name.startsWith("Teste Painel"));

describe("painel: controle de acesso das rotas novas", () => {
  test("anonimo = 401 e usuario comum = 403 em todas", async () => {
    const comum = await criarUsuario(app);
    const rotas = [
      ["get", "/api/admin/activity"],
      ["get", "/api/admin/quizzes"],
      ["get", "/api/admin/quizzes/1"],
      ["put", "/api/admin/questions/1"],
      ["get", "/api/admin/users"],
      ["put", "/api/admin/users/1/admin"],
    ];
    for (const [metodo, rota] of rotas) {
      expect([rota, (await request(app)[metodo](rota)).status]).toEqual([rota, 401]);
      expect([rota, (await request(app)[metodo](rota).set(comum.headers).send({})).status]).toEqual([rota, 403]);
    }
  });
});

describe("estatisticas e atividade", () => {
  test("estatisticas trazem os totais, a janela de 7 dias, a taxa de aprovacao e as areas mais feitas", async () => {
    const adm = await admin();
    const u = await criarUsuario(app);
    const python = await quizIdDaArea("python");
    const java = await quizIdDaArea("java");
    await request(app).post(`/api/quizzes/${python}/submit`).set(u.headers).send({ answers: await gabarito(python) });
    await request(app).post(`/api/quizzes/${python}/submit`).set(u.headers).send({ answers: await gabarito(python) });
    await request(app).post(`/api/quizzes/${java}/submit`).set(u.headers).send({ answers: await respostasErradas(java) });

    const { body } = await request(app).get("/api/admin/stats").set(adm.headers);
    expect(body).toMatchObject({
      users: 2, results: 3, certificates: 1, users_7d: 2, results_7d: 3, certificates_7d: 1, active_users_week: 1,
    });
    expect(body.pass_rate).toBeCloseTo(66.7, 1);
    expect(body.top_categories[0]).toEqual({ name: "Python", results: 2 });
    expect(body.top_categories.length).toBeLessThanOrEqual(5);
  });

  test("sem resultados a taxa de aprovacao e' 0 (sem divisao por zero)", async () => {
    const adm = await admin();
    const { body } = await request(app).get("/api/admin/stats").set(adm.headers);
    expect(body).toMatchObject({ results: 0, pass_rate: 0, top_categories: [] });
  });

  test("atividade recente: nome completo, quiz, nivel, aprovado e certificado; mais novo primeiro", async () => {
    const adm = await admin();
    const u = await criarUsuario(app, { name: "Ana Souza Lima" });
    const facil = await quizIdDaArea("python", "facil");
    const dificil = await quizIdDaArea("python", "dificil");
    await request(app).post(`/api/quizzes/${facil}/submit`).set(u.headers).send({ answers: await gabarito(facil) });
    await request(app).post(`/api/quizzes/${dificil}/submit`).set(u.headers).send({ answers: await respostasErradas(dificil) });
    const { body } = await request(app).get("/api/admin/activity").set(adm.headers);
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({ user_name: "Ana Souza Lima", difficulty: "dificil", passed: false, certificate: false, quiz_title: "Quiz de Python (Difícil)" });
    expect(body[1]).toMatchObject({ difficulty: "facil", passed: true, certificate: true });
    expect(JSON.stringify(body)).not.toContain(u.dados.email);
  });
});

describe("quizzes no painel", () => {
  test("lista todos os quizzes (inclusive desativados), com contagem de resultados, e filtra por area, nivel e texto", async () => {
    const adm = await admin();
    const u = await criarUsuario(app);
    const { categoriaId, quizId } = await quizDeTeste(adm);
    await request(app).post(`/api/quizzes/${quizId}/submit`).set(u.headers).send({ answers: await gabarito(quizId) });
    // Desativa: o jogador deixa de ver, o administrador continua vendo.
    const desativado = await request(app).put(`/api/admin/quizzes/${quizId}`).set(adm.headers)
      .send({ title: "Quiz descartavel", category_id: categoriaId, difficulty: "facil", time_limit: 0, is_active: false });
    expect(desativado.status).toBe(200);
    expect((await request(app).get("/api/quizzes").query({ category_id: categoriaId })).body).toEqual([]);

    const daArea = (await request(app).get("/api/admin/quizzes").query({ category_id: categoriaId }).set(adm.headers)).body;
    expect(daArea).toHaveLength(1);
    expect(daArea[0]).toMatchObject({ id: quizId, is_active: false, result_count: 1, question_count: 3 });

    // Catalogo real: 3 quizzes por area, do mais facil ao mais dificil.
    const cats = (await request(app).get("/api/categories")).body;
    const python = cats.find((c) => c.slug === "python");
    const doPython = (await request(app).get("/api/admin/quizzes").query({ category_id: python.id }).set(adm.headers)).body;
    expect(doPython.map((q) => q.difficulty)).toEqual(["facil", "media", "dificil"]);
    expect(doPython.every((q) => q.is_active && q.question_count === 6)).toBe(true);

    const todos = (await request(app).get("/api/admin/quizzes").set(adm.headers)).body;
    expect(todos.length - doCatalogo(todos).length).toBe(1); // o desativado tambem aparece
    expect(doCatalogo(todos)).toHaveLength(96);
    const dificeis = (await request(app).get("/api/admin/quizzes").query({ difficulty: "dificil" }).set(adm.headers)).body;
    expect(doCatalogo(dificeis)).toHaveLength(32);
    expect(dificeis.every((q) => q.difficulty === "dificil")).toBe(true);
    expect((await request(app).get("/api/admin/quizzes").query({ q: "linux" }).set(adm.headers)).body).toHaveLength(3);
    expect((await request(app).get("/api/admin/quizzes").query({ q: "'; DROP TABLE quizzes; --" }).set(adm.headers)).body).toEqual([]);
    expect((await request(app).get("/api/admin/quizzes").query({ difficulty: "x" }).set(adm.headers)).status).toBe(422);
    expect((await request(app).get("/api/admin/quizzes").query({ category_id: "abc" }).set(adm.headers)).status).toBe(422);
  });

  test("detalhe do quiz mostra as perguntas com a alternativa correta marcada (e o publico nao mostra)", async () => {
    const adm = await admin();
    const id = await quizIdDaArea("python", "dificil");
    const det = (await request(app).get(`/api/admin/quizzes/${id}`).set(adm.headers)).body;
    expect(det).toMatchObject({ id, difficulty: "dificil", question_count: 6, is_active: true });
    expect(det.questions).toHaveLength(6);
    for (const q of det.questions) {
      expect(q.alternatives).toHaveLength(4);
      expect(q.alternatives.filter((a) => a.is_correct)).toHaveLength(1);
    }
    const publico = (await request(app).get(`/api/quizzes/${id}`)).body;
    expect(JSON.stringify(publico)).not.toContain("is_correct");
    expect((await request(app).get("/api/admin/quizzes/999999").set(adm.headers)).status).toBe(404);
    expect((await request(app).get("/api/admin/quizzes/abc").set(adm.headers)).status).toBe(404);
  });

  test("edita uma pergunta (texto, pontos e alternativas) e o gabarito muda de verdade", async () => {
    const adm = await admin();
    const u = await criarUsuario(app);
    const { quizId } = await quizDeTeste(adm);
    const antes = (await request(app).get(`/api/admin/quizzes/${quizId}`).set(adm.headers)).body;
    const pergunta = antes.questions[0];

    const res = await request(app).put(`/api/admin/questions/${pergunta.id}`).set(adm.headers).send({
      text: "Pergunta reescrita?", points: 15,
      alternatives: [{ text: "Certa agora", is_correct: true }, { text: "Errada 1" }, { text: "Errada 2" }],
    });
    expect(res.status).toBe(200);

    const depois = (await request(app).get(`/api/admin/quizzes/${quizId}`).set(adm.headers)).body;
    const editada = depois.questions.find((q) => q.id === pergunta.id);
    expect(editada).toMatchObject({ text: "Pergunta reescrita?", points: 15 });
    expect(editada.alternatives.map((a) => a.text).sort()).toEqual(["Certa agora", "Errada 1", "Errada 2"]);
    expect(editada.alternatives.find((a) => a.is_correct).text).toBe("Certa agora");
    expect(depois.total_points).toBe(antes.total_points - pergunta.points + 15);
    expect(depois.questions.map((q) => q.id)).toEqual(antes.questions.map((q) => q.id)); // ordem preservada

    // O jogador que responde certo pelo gabarito novo acerta tudo.
    const enviado = await request(app).post(`/api/quizzes/${quizId}/submit`).set(u.headers).send({ answers: await gabarito(quizId) });
    expect(enviado.status).toBe(201);
    expect(enviado.body.percentage).toBe(100);
  });

  test("editar pergunta valida os dados: 422 sem alterar nada, e pergunta inexistente = 404", async () => {
    const adm = await admin();
    const { quizId } = await quizDeTeste(adm);
    const pid = (await request(app).get(`/api/admin/quizzes/${quizId}`).set(adm.headers)).body.questions[0].id;
    const invalidos = [
      { text: "x", points: 10, alternatives: [{ text: "a", is_correct: true }, { text: "b" }] },
      { text: "Enunciado valido", points: 0, alternatives: [{ text: "a", is_correct: true }, { text: "b" }] },
      { text: "Enunciado valido", points: 10, alternatives: [{ text: "a" }, { text: "b" }] },
      { text: "Enunciado valido", points: 10, alternatives: [{ text: "a", is_correct: true }, { text: "b", is_correct: true }] },
      { text: "Enunciado valido", points: 10, alternatives: [{ text: "a", is_correct: true }] },
    ];
    for (const corpo of invalidos) {
      expect((await request(app).put(`/api/admin/questions/${pid}`).set(adm.headers).send(corpo)).status).toBe(422);
    }
    // Recusada = nada mudou (a pergunta segue com as 4 alternativas originais).
    const det = (await request(app).get(`/api/admin/quizzes/${quizId}`).set(adm.headers)).body;
    expect(det.questions.find((q) => q.id === pid)).toMatchObject({ text: "Pergunta 1 do teste?", points: 10 });
    expect(det.questions.find((q) => q.id === pid).alternatives).toHaveLength(4);
    const ok = { text: "Enunciado valido", points: 10, alternatives: [{ text: "a", is_correct: true }, { text: "b" }] };
    expect((await request(app).put("/api/admin/questions/999999").set(adm.headers).send(ok)).status).toBe(404);
    expect((await request(app).put("/api/admin/questions/abc").set(adm.headers).send(ok)).status).toBe(404);
  });

  test("editar pergunta nao apaga o historico: a revisao de resultados antigos continua igual", async () => {
    const adm = await admin();
    const u = await criarUsuario(app);
    const { quizId } = await quizDeTeste(adm);
    const antes = await request(app).post(`/api/quizzes/${quizId}/submit`).set(u.headers).send({ answers: await gabarito(quizId) });
    expect(antes.status).toBe(201);
    const perguntaId = antes.body.review[0].question_id;
    await request(app).put(`/api/admin/questions/${perguntaId}`).set(adm.headers).send({
      text: "Outra pergunta?", points: 10, alternatives: [{ text: "x", is_correct: true }, { text: "y" }],
    });
    const depois = await request(app).get(`/api/results/${antes.body.id}`).set(u.headers);
    expect(depois.status).toBe(200);
    expect(depois.body.review[0].question).toBe(antes.body.review[0].question);
  });
});

describe("usuarios no painel", () => {
  test("lista com contagem de resultados e certificados, busca por nome/e-mail e nunca expoe a senha", async () => {
    const adm = await admin();
    const ana = await criarUsuario(app, { name: "Ana Souza", email: "ana.souza@example.com" });
    await criarUsuario(app, { name: "Bruno Lima", email: "bruno@example.com" });
    const id = await quizIdDaArea("python");
    await request(app).post(`/api/quizzes/${id}/submit`).set(ana.headers).send({ answers: await gabarito(id) });

    const todos = (await request(app).get("/api/admin/users").set(adm.headers)).body;
    expect(todos).toHaveLength(3);
    const linhaAna = todos.find((u) => u.email === "ana.souza@example.com");
    expect(linhaAna).toMatchObject({ name: "Ana Souza", is_admin: false, result_count: 1, certificate_count: 1 });
    expect(Object.keys(linhaAna).sort()).toEqual(["certificate_count", "created_at", "email", "id", "is_admin", "name", "result_count"]);
    expect(JSON.stringify(todos)).not.toMatch(/senha|hash|\$2[aby]\$/);

    expect((await request(app).get("/api/admin/users").query({ q: "bruno" }).set(adm.headers)).body).toHaveLength(1);
    expect((await request(app).get("/api/admin/users").query({ q: "EXAMPLE.COM" }).set(adm.headers)).body).toHaveLength(3); // inclui o administrador
    expect((await request(app).get("/api/admin/users").query({ q: "%' OR 1=1 --" }).set(adm.headers)).body).toEqual([]);
    expect((await request(app).get("/api/admin/users").query({ limit: "1" }).set(adm.headers)).body).toHaveLength(1);
    expect((await request(app).get("/api/admin/users").query({ limit: "1", page: "2" }).set(adm.headers)).body).toHaveLength(1);
    expect((await request(app).get("/api/admin/users").query({ page: "abc" }).set(adm.headers)).status).toBe(422);
  });

  test("promove e rebaixa administradores; o proprio acesso nao pode ser alterado", async () => {
    const adm = await admin();
    const ana = await criarUsuario(app, { name: "Ana Souza" });
    expect((await request(app).get("/api/admin/stats").set(ana.headers)).status).toBe(403);

    const promovida = await request(app).put(`/api/admin/users/${ana.usuario.id}/admin`).set(adm.headers).send({ is_admin: true });
    expect(promovida.status).toBe(200);
    expect(promovida.body).toMatchObject({ id: ana.usuario.id, is_admin: true });
    expect((await request(app).get("/api/admin/stats").set(ana.headers)).status).toBe(200); // vale na hora, sem novo login

    const rebaixada = await request(app).put(`/api/admin/users/${ana.usuario.id}/admin`).set(adm.headers).send({ is_admin: false });
    expect(rebaixada.body.is_admin).toBe(false);
    expect((await request(app).get("/api/admin/stats").set(ana.headers)).status).toBe(403);

    const proprio = await request(app).put(`/api/admin/users/${adm.usuario.id}/admin`).set(adm.headers).send({ is_admin: false });
    expect(proprio.status).toBe(409);
    expect((await request(app).get("/api/admin/stats").set(adm.headers)).status).toBe(200);
  });

  test("valida o corpo e o id", async () => {
    const adm = await admin();
    const ana = await criarUsuario(app);
    for (const corpo of [{}, { is_admin: "true" }, { is_admin: 1 }, { is_admin: null }]) {
      expect((await request(app).put(`/api/admin/users/${ana.usuario.id}/admin`).set(adm.headers).send(corpo)).status).toBe(422);
    }
    expect((await request(app).put("/api/admin/users/999999/admin").set(adm.headers).send({ is_admin: true })).status).toBe(404);
    expect((await request(app).put("/api/admin/users/abc/admin").set(adm.headers).send({ is_admin: true })).status).toBe(404);
  });

  test("usuario comum nao consegue se promover (mesmo sabendo a rota)", async () => {
    const ana = await criarUsuario(app);
    const res = await request(app).put(`/api/admin/users/${ana.usuario.id}/admin`).set(ana.headers).send({ is_admin: true });
    expect(res.status).toBe(403);
    expect((await request(app).get("/api/admin/stats").set(ana.headers)).status).toBe(403);
  });
});
