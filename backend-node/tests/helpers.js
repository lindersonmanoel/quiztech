"use strict";

const request = require("supertest");
const pool = require("../src/database/pool");
const { run: migrar } = require("../src/database/migrate");
const { semearAreas, semearNiveis } = require("../src/database/seed");

let contador = 0;

/** Aplica as migracoes e carrega as 32 areas e seus 3 niveis (idempotente). */
async function prepararBanco() {
  await migrar({ encerrarPool: false });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await semearAreas(client);
    await semearNiveis(client);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Zera o que os testes criam; as areas/quizzes/perguntas do seed ficam. */
async function limparUsuarios() {
  await pool.query("TRUNCATE TABLE usuarios RESTART IDENTITY CASCADE");
}

/** Cadastra e devolve { token, headers, usuario, dados }. */
async function criarUsuario(app, over = {}) {
  contador += 1;
  const dados = {
    name: over.name || `Usuário Teste ${contador}`,
    email: over.email || `usuario${contador}.${Date.now()}@example.com`,
    password: over.password || "senhaForte123",
  };
  const res = await request(app).post("/api/auth/register").send(dados);
  if (res.status !== 201) throw new Error(`cadastro falhou: ${res.status} ${JSON.stringify(res.body)}`);
  return { dados, usuario: res.body.user, token: res.body.access_token, headers: { Authorization: `Bearer ${res.body.access_token}` } };
}

/** Sem `dificuldade`, devolve o quiz de menor id da area (o nivel "media", carregado primeiro). */
async function quizIdDaArea(slug, dificuldade = null) {
  const { rows } = await pool.query(
    "SELECT q.id FROM quizzes q JOIN categorias c ON c.id = q.categoria_id WHERE c.slug = $1 AND ($2::text IS NULL OR q.dificuldade = $2) ORDER BY q.id LIMIT 1",
    [slug, dificuldade]
  );
  return rows[0].id;
}

/** Gabarito direto do banco: { perguntaId: alternativaCorretaId }. */
async function gabarito(quizId) {
  const { rows } = await pool.query(
    "SELECT p.id AS pergunta, a.id AS alternativa FROM perguntas p JOIN alternativas a ON a.pergunta_id = p.id WHERE p.quiz_id = $1 AND a.correta ORDER BY p.posicao",
    [quizId]
  );
  return rows.map((r) => ({ question_id: r.pergunta, alternative_id: r.alternativa }));
}

/** Uma alternativa ERRADA por pergunta. */
async function respostasErradas(quizId) {
  const { rows } = await pool.query(
    "SELECT DISTINCT ON (p.id) p.id AS pergunta, a.id AS alternativa FROM perguntas p JOIN alternativas a ON a.pergunta_id = p.id WHERE p.quiz_id = $1 AND NOT a.correta ORDER BY p.id, a.id",
    [quizId]
  );
  return rows.map((r) => ({ question_id: r.pergunta, alternative_id: r.alternativa }));
}

/** Zera a espera para refazer (o intervalo em si e' testado a parte). */
async function semEspera(usuarioId) {
  await pool.query("UPDATE resultados SET criado_em = now() - interval '1 day' WHERE usuario_id = $1", [usuarioId]);
}

module.exports = { prepararBanco, limparUsuarios, criarUsuario, quizIdDaArea, gabarito, respostasErradas, semEspera };
