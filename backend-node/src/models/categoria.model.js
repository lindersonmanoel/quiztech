"use strict";

const pool = require("../database/pool");

async function listarComContagem() {
  const { rows } = await pool.query(
    `SELECT c.id, c.nome, c.slug, c.grupo, c.icone, c.descricao,
            COUNT(q.id) FILTER (WHERE q.ativo)::int AS quiz_count
       FROM categorias c
       LEFT JOIN quizzes q ON q.categoria_id = c.id
      GROUP BY c.id
      ORDER BY c.grupo, c.nome`
  );
  return rows;
}

async function buscarPorId(id) {
  const { rows } = await pool.query("SELECT * FROM categorias WHERE id = $1", [id]);
  return rows[0] || null;
}

async function criar({ nome, slug, grupo, icone, descricao }) {
  const { rows } = await pool.query(
    `INSERT INTO categorias (nome, slug, grupo, icone, descricao) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [nome, slug, grupo, icone, descricao]
  );
  return rows[0];
}

async function atualizar(id, { nome, slug, grupo, icone, descricao }) {
  const { rows } = await pool.query(
    `UPDATE categorias SET nome = $1, slug = $2, grupo = $3, icone = $4, descricao = $5 WHERE id = $6 RETURNING *`,
    [nome, slug, grupo, icone, descricao, id]
  );
  return rows[0] || null;
}

async function temResultados(id) {
  const { rows } = await pool.query(
    `SELECT EXISTS (SELECT 1 FROM resultados r JOIN quizzes q ON q.id = r.quiz_id WHERE q.categoria_id = $1) AS existe`,
    [id]
  );
  return rows[0].existe;
}

async function excluir(id) {
  const { rowCount } = await pool.query("DELETE FROM categorias WHERE id = $1", [id]);
  return rowCount > 0;
}

module.exports = { listarComContagem, buscarPorId, criar, atualizar, temResultados, excluir };
