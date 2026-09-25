"use strict";

const pool = require("../database/pool");

async function estatisticas(fuso, aprovacao) {
  const { rows } = await pool.query(
    `SELECT (SELECT COUNT(*)::int FROM usuarios) AS users,
            (SELECT COUNT(*)::int FROM categorias) AS categories,
            (SELECT COUNT(*)::int FROM quizzes) AS quizzes,
            (SELECT COUNT(*)::int FROM perguntas) AS questions,
            (SELECT COUNT(*)::int FROM resultados) AS results,
            (SELECT COUNT(*)::int FROM certificados) AS certificates,
            (SELECT COUNT(*)::int FROM usuarios WHERE criado_em >= now() - interval '7 days') AS users_7d,
            (SELECT COUNT(*)::int FROM resultados WHERE criado_em >= now() - interval '7 days') AS results_7d,
            (SELECT COUNT(*)::int FROM certificados WHERE emitido_em >= now() - interval '7 days') AS certificates_7d,
            (SELECT COUNT(DISTINCT usuario_id)::int FROM resultados WHERE criado_em >= (date_trunc('week', now() AT TIME ZONE $1) AT TIME ZONE $1)) AS active_users_week,
            (SELECT COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE percentual >= $2) / NULLIF(COUNT(*), 0), 1), 0)::float8 FROM resultados) AS pass_rate`,
    [fuso, aprovacao]
  );
  const porArea = await pool.query(
    `SELECT c.nome AS name, COUNT(r.id)::int AS results
       FROM resultados r JOIN quizzes q ON q.id = r.quiz_id JOIN categorias c ON c.id = q.categoria_id
      GROUP BY c.id, c.nome ORDER BY results DESC, c.nome LIMIT 5`
  );
  return { ...rows[0], top_categories: porArea.rows };
}

/** Ultimos resultados da plataforma (para o painel). */
async function atividadeRecente(limite = 15) {
  const { rows } = await pool.query(
    `SELECT r.id, u.nome AS usuario_nome, q.titulo AS quiz_titulo, q.dificuldade, r.percentual::float8 AS percentual, r.pontos, r.criado_em,
            EXISTS (SELECT 1 FROM certificados c WHERE c.resultado_id = r.id) AS certificado
       FROM resultados r JOIN usuarios u ON u.id = r.usuario_id JOIN quizzes q ON q.id = r.quiz_id
      ORDER BY r.criado_em DESC, r.id DESC LIMIT $1`,
    [limite]
  );
  return rows;
}

async function listarUsuarios({ busca = null, limite = 50, deslocamento = 0 } = {}) {
  const { rows } = await pool.query(
    `SELECT u.id, u.nome, u.email, u.is_admin, u.criado_em,
            (SELECT COUNT(*)::int FROM resultados r WHERE r.usuario_id = u.id) AS total_resultados,
            (SELECT COUNT(*)::int FROM certificados c WHERE c.usuario_id = u.id) AS total_certificados
       FROM usuarios u
      WHERE $1::text IS NULL OR u.nome ILIKE '%' || $1 || '%' OR u.email ILIKE '%' || $1 || '%'
      ORDER BY u.criado_em DESC, u.id DESC LIMIT $2 OFFSET $3`,
    [busca, limite, deslocamento]
  );
  return rows;
}

async function definirAdmin(id, valor) {
  const { rows } = await pool.query(
    "UPDATE usuarios SET is_admin = $1, atualizado_em = now() WHERE id = $2 RETURNING id, nome, email, is_admin, criado_em",
    [valor, id]
  );
  return rows[0] || null;
}

module.exports = { estatisticas, atividadeRecente, listarUsuarios, definirAdmin };
