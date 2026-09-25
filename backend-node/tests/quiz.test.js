"use strict";

const request = require("supertest");
const createApp = require("../src/app");
const pool = require("../src/database/pool");
const config = require("../src/config");
const { prepararBanco, limparUsuarios, criarUsuario, quizIdDaArea, gabarito, respostasErradas, semEspera } = require("./helpers");

const app = createApp();

beforeAll(prepararBanco);
beforeEach(limparUsuarios);
afterAll(() => pool.end());

describe("catalogo", () => {
  test("32 areas semeadas, cada uma com 1 quiz de 6 perguntas e 4 alternativas", async () => {
    const cats = (await request(app).get("/api/categories")).body;
    expect(cats).toHaveLength(32);
    expect(cats.every((c) => c.quiz_count === 1)).toBe(true);
    expect(new Set(cats.map((c) => c.slug)).size).toBe(32);
    const { rows } = await pool.query(
      "SELECT (SELECT COUNT(*)::int FROM perguntas) AS p, (SELECT COUNT(*)::int FROM alternativas) AS a, (SELECT COUNT(*)::int FROM alternativas WHERE correta) AS c"
    );
    expect(rows[0]).toEqual({ p: 192, a: 768, c: 192 });
  });

  test("lista de quizzes filtra por categoria e por texto (sem SQL injection)", async () => {
    const cats = (await request(app).get("/api/categories")).body;
    const python = cats.find((c) => c.slug === "python");
    const porCat = (await request(app).get("/api/quizzes").query({ category_id: python.id })).body;
    expect(porCat).toHaveLength(1);
    expect(python.icon).toBe("python");
    expect(porCat[0]).toMatchObject({ title: "Quiz de Python", question_count: 6, total_points: 120, difficulty: "media", time_limit: 300 });
    expect((await request(app).get("/api/quizzes").query({ q: "redes" })).body).toHaveLength(1);
    const injecao = await request(app).get("/api/quizzes").query({ q: "'; DROP TABLE usuarios; --" });
    expect(injecao.status).toBe(200);
    expect(injecao.body).toEqual([]);
    expect((await request(app).get("/api/quizzes").query({ category_id: "abc" })).status).toBe(422);
  });

  test("detalhe do quiz nunca vaza o gabarito e embaralha as alternativas", async () => {
    const id = await quizIdDaArea("python");
    const res = await request(app).get(`/api/quizzes/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(6);
    for (const q of res.body.questions) {
      expect(Object.keys(q).sort()).toEqual(["alternatives", "id", "points", "text"]);
      expect(q.alternatives).toHaveLength(4);
      for (const a of q.alternatives) expect(Object.keys(a).sort()).toEqual(["id", "text"]);
    }
    expect(JSON.stringify(res.body)).not.toMatch(/correct|correta/i);
    // ordem varia entre chamadas: em 30 tentativas o texto correto nao fica sempre na 1a posicao
    const g = await gabarito(id);
    const primeiraPergunta = g[0].question_id;
    const posicoes = new Set();
    for (let i = 0; i < 30; i += 1) {
      const q = (await request(app).get(`/api/quizzes/${id}`)).body.questions.find((x) => x.id === primeiraPergunta);
      posicoes.add(q.alternatives.findIndex((a) => a.id === g[0].alternative_id));
    }
    expect(posicoes.size).toBeGreaterThan(1);
  });

  test("quiz inexistente, inativo ou com id fora do intervalo = 404", async () => {
    expect((await request(app).get("/api/quizzes/999999")).status).toBe(404);
    expect((await request(app).get("/api/quizzes/99999999999999")).status).toBe(404);
    expect((await request(app).get("/api/quizzes/abc")).status).toBe(404);
    const id = await quizIdDaArea("python");
    await pool.query("UPDATE quizzes SET ativo = false WHERE id = $1", [id]);
    expect((await request(app).get(`/api/quizzes/${id}`)).status).toBe(404);
    await pool.query("UPDATE quizzes SET ativo = true WHERE id = $1", [id]);
  });
});

describe("responder o quiz", () => {
  test("exige login", async () => {
    const id = await quizIdDaArea("python");
    expect((await request(app).post(`/api/quizzes/${id}/submit`).send({ answers: [] })).status).toBe(401);
  });

  test("100%: aprova, emite o certificado uma unica vez e mostra o gabarito", async () => {
    const u = await criarUsuario(app, { name: "Linderson Manoel Brito Venancio" });
    const id = await quizIdDaArea("python");
    const answers = await gabarito(id);
    const res = await request(app).post(`/api/quizzes/${id}/submit`).set(u.headers).send({ answers, time_spent: 42 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ score: 120, max_score: 120, correct_answers: 6, wrong_answers: 0, percentage: 100, passed: true, time_spent: 42 });
    expect(res.body.certificate.code).toMatch(/^QT-[0-9A-F]{8}-[0-9A-F]{4}$/);
    expect(res.body.certificate.user_name).toBe("Linderson Manoel Brito Venancio");
    expect(res.body.review.every((r) => r.is_correct && r.correct_text)).toBe(true);

    const de_novo = await request(app).post(`/api/quizzes/${id}/submit`).set(u.headers).send({ answers });
    expect(de_novo.body.certificate.code).toBe(res.body.certificate.code); // nao emite duplicado
    const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM certificados");
    expect(rows[0].n).toBe(1);
  });

  test("limite de aprovacao: 4 de 6 (66,7%) reprova; 5 de 6 (83,3%) aprova", async () => {
    const id = await quizIdDaArea("python");
    const certas = await gabarito(id);
    const erradas = await respostasErradas(id);

    const a = await criarUsuario(app);
    const quatro = [...certas.slice(0, 4), ...erradas.slice(4)];
    const r4 = (await request(app).post(`/api/quizzes/${id}/submit`).set(a.headers).send({ answers: quatro })).body;
    expect(r4).toMatchObject({ correct_answers: 4, percentage: 66.7, passed: false, certificate: null });

    const b = await criarUsuario(app);
    const cinco = [...certas.slice(0, 5), ...erradas.slice(5)];
    const r5 = (await request(app).post(`/api/quizzes/${id}/submit`).set(b.headers).send({ answers: cinco })).body;
    expect(r5).toMatchObject({ correct_answers: 5, percentage: 83.3, passed: true });
    expect(r5.certificate).not.toBeNull();
  });

  test("reprovado nao recebe o gabarito (nem na resposta nem ao reabrir o resultado)", async () => {
    const u = await criarUsuario(app);
    const id = await quizIdDaArea("python");
    const certas = await gabarito(id);
    const answers = certas.slice(0, 3); // acerta 3, deixa 3 em branco
    const res = await request(app).post(`/api/quizzes/${id}/submit`).set(u.headers).send({ answers });
    expect(res.body).toMatchObject({ percentage: 50, passed: false, correct_answers: 3, wrong_answers: 3, certificate: null });
    expect(res.body.review.filter((r) => !r.is_correct)).toHaveLength(3);
    expect(res.body.review.every((r) => r.correct_id === null && r.correct_text === null)).toBe(true);

    const reaberto = (await request(app).get(`/api/results/${res.body.id}`).set(u.headers)).body;
    expect(reaberto.review.every((r) => r.correct_id === null && r.correct_text === null)).toBe(true);
    // o gabarito segue guardado no banco para quando a pessoa for aprovada
    const { rows } = await pool.query("SELECT revisao FROM resultados WHERE id = $1", [res.body.id]);
    expect(rows[0].revisao.every((r) => r.correct_text)).toBe(true);
  });

  test("alternativa de OUTRA pergunta nao conta (resposta forjada)", async () => {
    const u = await criarUsuario(app);
    const id = await quizIdDaArea("python");
    const certas = await gabarito(id);
    const forjada = [{ question_id: certas[0].question_id, alternative_id: certas[1].alternative_id }];
    const res = await request(app).post(`/api/quizzes/${id}/submit`).set(u.headers).send({ answers: forjada });
    expect(res.body.correct_answers).toBe(0);
    expect(res.body.review[0].chosen_id).toBeNull();
  });

  test.each([
    ["answers ausente", {}],
    ["answers nao e lista", { answers: "x" }],
    ["mais de 200 respostas", { answers: Array.from({ length: 201 }, () => ({ question_id: 1 })) }],
    ["question_id invalido", { answers: [{ question_id: "a" }] }],
    ["tempo negativo", { answers: [], time_spent: -1 }],
    ["tempo absurdo", { answers: [], time_spent: 999999 }],
  ])("recusa %s com 422", async (_r, corpo) => {
    const u = await criarUsuario(app);
    const id = await quizIdDaArea("python");
    expect((await request(app).post(`/api/quizzes/${id}/submit`).set(u.headers).send(corpo)).status).toBe(422);
  });

  test("o tempo gasto e' limitado ao tempo do quiz", async () => {
    const u = await criarUsuario(app);
    const id = await quizIdDaArea("python");
    const res = await request(app).post(`/api/quizzes/${id}/submit`).set(u.headers).send({ answers: [], time_spent: 86000 });
    expect(res.body.time_spent).toBe(300);
  });
});

describe("intervalo para refazer", () => {
  test("depois de reprovar: 429 com Retry-After, tambem ao abrir o quiz; outros usuarios nao sao afetados", async () => {
    const u = await criarUsuario(app);
    const outro = await criarUsuario(app);
    const id = await quizIdDaArea("python");
    expect((await request(app).post(`/api/quizzes/${id}/submit`).set(u.headers).send({ answers: [] })).status).toBe(201);

    const de_novo = await request(app).post(`/api/quizzes/${id}/submit`).set(u.headers).send({ answers: [] });
    expect(de_novo.status).toBe(429);
    expect(Number(de_novo.headers["retry-after"])).toBeGreaterThan(0);
    expect(de_novo.body.erro).toMatch(/Aguarde \d+ min/);
    expect((await request(app).get(`/api/quizzes/${id}`).set(u.headers)).status).toBe(429);
    expect((await request(app).get(`/api/quizzes/${id}`)).status).toBe(200); // anonimo
    expect((await request(app).get(`/api/quizzes/${id}`).set(outro.headers)).status).toBe(200);
  });

  test("libera depois do prazo e nao vale para quem ja tem o certificado", async () => {
    const u = await criarUsuario(app);
    const id = await quizIdDaArea("python");
    await request(app).post(`/api/quizzes/${id}/submit`).set(u.headers).send({ answers: [] });
    await semEspera(u.usuario.id);
    expect((await request(app).post(`/api/quizzes/${id}/submit`).set(u.headers).send({ answers: await gabarito(id) })).status).toBe(201);
    // ja certificado: refazer nao tem espera
    expect((await request(app).post(`/api/quizzes/${id}/submit`).set(u.headers).send({ answers: [] })).status).toBe(201);
    expect((await request(app).post(`/api/quizzes/${id}/submit`).set(u.headers).send({ answers: [] })).status).toBe(201);
  });

  test("RETAKE_COOLDOWN_SECONDS=0 desliga o intervalo", async () => {
    const original = config.refazerEsperaSegundos;
    config.refazerEsperaSegundos = 0;
    try {
      const u = await criarUsuario(app);
      const id = await quizIdDaArea("python");
      await request(app).post(`/api/quizzes/${id}/submit`).set(u.headers).send({ answers: [] });
      expect((await request(app).post(`/api/quizzes/${id}/submit`).set(u.headers).send({ answers: [] })).status).toBe(201);
    } finally {
      config.refazerEsperaSegundos = original;
    }
  });
});
