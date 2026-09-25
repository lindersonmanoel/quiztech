"use strict";

const request = require("supertest");
const createApp = require("../src/app");
const pool = require("../src/database/pool");
const { version } = require("../package.json");
const { run: migrar } = require("../src/database/migrate");
const { semearAreas } = require("../src/database/seed");
const { prepararBanco } = require("./helpers");

const app = createApp();

beforeAll(prepararBanco);
afterAll(() => pool.end());

describe("saude e versao", () => {
  test("/api/health responde sem consultar o banco", async () => {
    expect((await request(app).get("/api/health")).body).toEqual({ status: "ok", ambiente: "test" });
  });

  test("/api/health/ready confere o banco", async () => {
    expect((await request(app).get("/api/health/ready")).body).toEqual({ status: "ok", banco: "ok" });
  });

  test("/api/version traz versao do package.json, commit de 7 caracteres, ambiente e nao e' cacheada", async () => {
    process.env.GIT_COMMIT = "abc1234def5678";
    const res = await request(app).get("/api/version");
    expect(res.body).toEqual({ name: "QUIZ TECH", version, commit: "abc1234", environment: "test" });
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    delete process.env.GIT_COMMIT;
  });
});

describe("banco de dados", () => {
  test("migracoes sao idempotentes e ficam registradas", async () => {
    await migrar({ encerrarPool: false });
    await migrar({ encerrarPool: false });
    const { rows } = await pool.query("SELECT nome FROM _migrations ORDER BY nome");
    expect(rows.map((r) => r.nome)).toContain("001_init.sql");
    expect(new Set(rows.map((r) => r.nome)).size).toBe(rows.length);
  });

  test("o seed e' idempotente (nao duplica areas, quizzes nem perguntas)", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      expect(await semearAreas(client)).toBe(0);
      await client.query("COMMIT");
    } finally {
      client.release();
    }
    const { rows } = await pool.query("SELECT (SELECT COUNT(*)::int FROM categorias) AS c, (SELECT COUNT(*)::int FROM perguntas) AS p");
    expect(rows[0]).toEqual({ c: 32, p: 192 });
  });

  test("o seed cria so' as areas que faltam", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const criadas = await semearAreas(client, [
        { grupo: "Testes", nome: "Só Esta Área", slug: "teste-seed-parcial", icone: "🧪", descricao: "x",
          quiz: { titulo: "Quiz", descricao: "x", dificuldade: "facil", limite_tempo: 0 },
          perguntas: [{ texto: "Pergunta?", pontos: 10, correta: "sim", erradas: ["não", "talvez", "nunca"] }] },
      ]);
      expect(criadas).toBe(1);
      await client.query("ROLLBACK"); // nao deixa lixo
    } finally {
      client.release();
    }
  });

  test("restricoes do esquema: uma correta por pergunta, dificuldade valida, pontos entre 1 e 100, e-mail unico sem caixa", async () => {
    const { rows } = await pool.query("SELECT id FROM perguntas LIMIT 1");
    await expect(pool.query("INSERT INTO alternativas (pergunta_id, texto, correta) VALUES ($1, 'outra correta', true)", [rows[0].id]))
      .rejects.toMatchObject({ code: "23505" });
    await expect(pool.query("UPDATE quizzes SET dificuldade = 'absurda' WHERE id = (SELECT id FROM quizzes LIMIT 1)"))
      .rejects.toMatchObject({ code: "23514" });
    await expect(pool.query("UPDATE perguntas SET pontos = 101 WHERE id = $1", [rows[0].id])).rejects.toMatchObject({ code: "23514" });
    await pool.query("INSERT INTO usuarios (nome, email, senha_hash) VALUES ('A', 'Caixa@Exemplo.com', 'x')");
    await expect(pool.query("INSERT INTO usuarios (nome, email, senha_hash) VALUES ('B', 'caixa@exemplo.com', 'x')"))
      .rejects.toMatchObject({ code: "23505" });
    await pool.query("DELETE FROM usuarios WHERE lower(email) = 'caixa@exemplo.com'");
  });
});
