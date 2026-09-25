"use strict";

const pool = require("../database/pool");

const RESUMO_SQL = `
  SELECT q.id, q.titulo, q.descricao, q.categoria_id, c.nome AS categoria_nome, q.dificuldade, q.limite_tempo, q.ativo,
         (SELECT COUNT(*)::int FROM perguntas p WHERE p.quiz_id = q.id) AS total_perguntas,
         (SELECT COALESCE(SUM(p.pontos), 0)::int FROM perguntas p WHERE p.quiz_id = q.id) AS total_pontos
    FROM quizzes q
    JOIN categorias c ON c.id = q.categoria_id`;

async function listarAtivos({ categoriaId = null, busca = null } = {}) {
  const { rows } = await pool.query(
    `${RESUMO_SQL}
      WHERE q.ativo
        AND ($1::int IS NULL OR q.categoria_id = $1)
        AND ($2::text IS NULL OR q.titulo ILIKE '%' || $2 || '%')
      ORDER BY q.id`,
    [categoriaId, busca]
  );
  return rows;
}

/** Todos os quizzes (inclusive desativados) para o painel do administrador. */
async function listarTodos({ categoriaId = null, dificuldade = null, busca = null } = {}) {
  const { rows } = await pool.query(
    `SELECT s.*, (SELECT COUNT(*)::int FROM resultados r WHERE r.quiz_id = s.id) AS total_resultados
       FROM (${RESUMO_SQL}) s
      WHERE ($1::int IS NULL OR s.categoria_id = $1)
        AND ($2::text IS NULL OR s.dificuldade = $2)
        AND ($3::text IS NULL OR s.titulo ILIKE '%' || $3 || '%' OR s.categoria_nome ILIKE '%' || $3 || '%')
      ORDER BY s.categoria_nome, CASE s.dificuldade WHEN 'facil' THEN 1 WHEN 'media' THEN 2 ELSE 3 END, s.id`,
    [categoriaId, dificuldade, busca]
  );
  return rows;
}

async function buscarResumo(id, { somenteAtivo = true } = {}) {
  const { rows } = await pool.query(`${RESUMO_SQL} WHERE q.id = $1 ${somenteAtivo ? "AND q.ativo" : ""}`, [id]);
  return rows[0] || null;
}

/** Quiz com perguntas e alternativas (3 consultas no total, sem N+1). */
async function buscarCompleto(id, opcoes) {
  const quiz = await buscarResumo(id, opcoes);
  if (!quiz) return null;
  const perguntas = await pool.query("SELECT id, texto, pontos, posicao FROM perguntas WHERE quiz_id = $1 ORDER BY posicao, id", [id]);
  const alternativas = await pool.query(
    `SELECT a.id, a.pergunta_id, a.texto, a.correta
       FROM alternativas a JOIN perguntas p ON p.id = a.pergunta_id
      WHERE p.quiz_id = $1 ORDER BY a.id`,
    [id]
  );
  const porPergunta = new Map();
  for (const alt of alternativas.rows) {
    if (!porPergunta.has(alt.pergunta_id)) porPergunta.set(alt.pergunta_id, []);
    porPergunta.get(alt.pergunta_id).push(alt);
  }
  quiz.perguntas = perguntas.rows.map((p) => ({ ...p, alternativas: porPergunta.get(p.id) || [] }));
  return quiz;
}

async function criar({ titulo, descricao, categoriaId, dificuldade, limiteTempo, ativo }) {
  const { rows } = await pool.query(
    `INSERT INTO quizzes (titulo, descricao, categoria_id, dificuldade, limite_tempo, ativo)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [titulo, descricao, categoriaId, dificuldade, limiteTempo, ativo]
  );
  return rows[0].id;
}

async function atualizar(id, { titulo, descricao, categoriaId, dificuldade, limiteTempo, ativo }) {
  const { rowCount } = await pool.query(
    `UPDATE quizzes SET titulo = $1, descricao = $2, categoria_id = $3, dificuldade = $4, limite_tempo = $5, ativo = $6 WHERE id = $7`,
    [titulo, descricao, categoriaId, dificuldade, limiteTempo, ativo, id]
  );
  return rowCount > 0;
}

async function contarResultados(id) {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM resultados WHERE quiz_id = $1", [id]);
  return rows[0].n;
}

async function desativar(id) {
  await pool.query("UPDATE quizzes SET ativo = false WHERE id = $1", [id]);
}

async function excluir(id) {
  const { rowCount } = await pool.query("DELETE FROM quizzes WHERE id = $1", [id]);
  return rowCount > 0;
}

async function criarPergunta({ quizId, texto, pontos, alternativas }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const pos = await client.query("SELECT COALESCE(MAX(posicao) + 1, 0)::int AS proxima FROM perguntas WHERE quiz_id = $1", [quizId]);
    const p = await client.query(
      "INSERT INTO perguntas (quiz_id, texto, pontos, posicao) VALUES ($1, $2, $3, $4) RETURNING id",
      [quizId, texto, pontos, pos.rows[0].proxima]
    );
    for (const alt of alternativas) {
      await client.query("INSERT INTO alternativas (pergunta_id, texto, correta) VALUES ($1, $2, $3)", [p.rows[0].id, alt.texto, alt.correta]);
    }
    await client.query("COMMIT");
    return p.rows[0].id;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Troca enunciado, pontos e alternativas (as antigas saem e as novas entram, na mesma transacao). */
async function atualizarPergunta(id, { texto, pontos, alternativas }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rowCount } = await client.query("UPDATE perguntas SET texto = $1, pontos = $2 WHERE id = $3", [texto, pontos, id]);
    if (!rowCount) {
      await client.query("ROLLBACK");
      return false;
    }
    await client.query("DELETE FROM alternativas WHERE pergunta_id = $1", [id]);
    for (const alt of alternativas) {
      await client.query("INSERT INTO alternativas (pergunta_id, texto, correta) VALUES ($1, $2, $3)", [id, alt.texto, alt.correta]);
    }
    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function excluirPergunta(id) {
  const { rowCount } = await pool.query("DELETE FROM perguntas WHERE id = $1", [id]);
  return rowCount > 0;
}

module.exports = {
  listarAtivos, listarTodos, buscarResumo, buscarCompleto, criar, atualizar, contarResultados, desativar, excluir,
  criarPergunta, atualizarPergunta, excluirPergunta,
};
