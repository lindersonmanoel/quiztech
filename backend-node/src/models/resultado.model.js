"use strict";

const pool = require("../database/pool");

const CAMPOS = `r.id, r.usuario_id, r.quiz_id, qz.titulo AS quiz_titulo, qz.dificuldade, r.pontos, r.pontos_maximos, r.acertos, r.erros,
                r.percentual::float8 AS percentual, r.tempo_gasto, r.revisao, r.criado_em`;

async function ultimoDoUsuario(usuarioId, quizId) {
  const { rows } = await pool.query(
    `SELECT id, percentual::float8 AS percentual, criado_em FROM resultados
      WHERE usuario_id = $1 AND quiz_id = $2 ORDER BY criado_em DESC, id DESC LIMIT 1`,
    [usuarioId, quizId]
  );
  return rows[0] || null;
}

/** Grava o resultado usando o `client` da transacao do chamador. */
async function criar(client, d) {
  const { rows } = await client.query(
    `INSERT INTO resultados (usuario_id, quiz_id, pontos, pontos_maximos, acertos, erros, percentual, tempo_gasto, revisao)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
     RETURNING id, criado_em`,
    [d.usuarioId, d.quizId, d.pontos, d.pontosMaximos, d.acertos, d.erros, d.percentual, d.tempoGasto, JSON.stringify(d.revisao)]
  );
  return rows[0];
}

async function listarDoUsuario(usuarioId, limite = 100) {
  const { rows } = await pool.query(
    `SELECT ${CAMPOS} FROM resultados r JOIN quizzes qz ON qz.id = r.quiz_id
      WHERE r.usuario_id = $1 ORDER BY r.criado_em DESC, r.id DESC LIMIT $2`,
    [usuarioId, limite]
  );
  return rows;
}

async function buscarDoUsuario(id, usuarioId) {
  const { rows } = await pool.query(
    `SELECT ${CAMPOS} FROM resultados r JOIN quizzes qz ON qz.id = r.quiz_id WHERE r.id = $1 AND r.usuario_id = $2`,
    [id, usuarioId]
  );
  return rows[0] || null;
}

/**
 * Soma a melhor pontuacao de cada usuario em cada quiz (refazer nao infla o ranking).
 * `periodo`: null = desde sempre; "week" = semana atual (a partir de segunda); "month" = mes atual. O inicio e' contado
 * no fuso `fuso` (o do Brasil), nao em UTC: a semana vira na madrugada de segunda daqui.
 */
async function ranking({ categoriaId = null, quizId = null, dificuldade = null, periodo = null, fuso = "America/Sao_Paulo", limite = 50 } = {}) {
  const { rows } = await pool.query(
    `WITH melhores AS (
       SELECT r.usuario_id, r.quiz_id, MAX(r.pontos) AS melhor
         FROM resultados r JOIN quizzes q ON q.id = r.quiz_id
        WHERE ($1::int IS NULL OR r.quiz_id = $1) AND ($2::int IS NULL OR q.categoria_id = $2)
          AND ($4::text IS NULL OR q.dificuldade = $4)
          AND ($5::text IS NULL OR r.criado_em >= (date_trunc($5, now() AT TIME ZONE $6) AT TIME ZONE $6))
        GROUP BY r.usuario_id, r.quiz_id)
     SELECT u.nome, SUM(m.melhor)::int AS total, COUNT(*)::int AS quizzes
       FROM melhores m JOIN usuarios u ON u.id = m.usuario_id
      GROUP BY u.id, u.nome
      ORDER BY total DESC, u.nome
      LIMIT $3`,
    [quizId, categoriaId, limite, dificuldade, periodo, fuso]
  );
  return rows;
}

module.exports = { ultimoDoUsuario, criar, listarDoUsuario, buscarDoUsuario, ranking };
