"use strict";

const pool = require("../database/pool");

const CAMPOS = `c.codigo, u.nome AS usuario_nome, c.quiz_id, q.titulo AS quiz_titulo, cat.nome AS categoria_nome,
                c.pontos, c.percentual::float8 AS percentual, c.emitido_em`;
const JUNCOES = `FROM certificados c
                   JOIN usuarios u ON u.id = c.usuario_id
                   JOIN quizzes q ON q.id = c.quiz_id
                   JOIN categorias cat ON cat.id = q.categoria_id`;

async function existe(usuarioId, quizId) {
  const { rows } = await pool.query("SELECT 1 FROM certificados WHERE usuario_id = $1 AND quiz_id = $2", [usuarioId, quizId]);
  return rows.length > 0;
}

/** Emite o certificado na transacao do chamador. ON CONFLICT: se dois envios simultaneos passarem juntos, so' um vale. */
async function emitir(client, { codigo, usuarioId, quizId, resultadoId, pontos, percentual }) {
  const { rows } = await client.query(
    `INSERT INTO certificados (codigo, usuario_id, quiz_id, resultado_id, pontos, percentual)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (usuario_id, quiz_id) DO NOTHING
     RETURNING codigo`,
    [codigo, usuarioId, quizId, resultadoId, pontos, percentual]
  );
  return rows[0] ? rows[0].codigo : null;
}

async function buscarPorCodigo(codigo) {
  const { rows } = await pool.query(`SELECT ${CAMPOS} ${JUNCOES} WHERE c.codigo = $1`, [codigo]);
  return rows[0] || null;
}

async function buscarDoUsuarioNoQuiz(usuarioId, quizId, client = pool) {
  const { rows } = await client.query(`SELECT ${CAMPOS} ${JUNCOES} WHERE c.usuario_id = $1 AND c.quiz_id = $2`, [usuarioId, quizId]);
  return rows[0] || null;
}

async function buscarPorResultado(resultadoId) {
  const { rows } = await pool.query(`SELECT ${CAMPOS} ${JUNCOES} WHERE c.resultado_id = $1`, [resultadoId]);
  return rows[0] || null;
}

async function listarDoUsuario(usuarioId) {
  const { rows } = await pool.query(`SELECT ${CAMPOS} ${JUNCOES} WHERE c.usuario_id = $1 ORDER BY c.emitido_em DESC`, [usuarioId]);
  return rows;
}

module.exports = { existe, emitir, buscarPorCodigo, buscarDoUsuarioNoQuiz, buscarPorResultado, listarDoUsuario };
