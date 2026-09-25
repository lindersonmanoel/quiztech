"use strict";

const pool = require("../database/pool");

const CAMPOS_PUBLICOS = "id, nome, email, is_admin, criado_em";

async function findByEmail(email) {
  const { rows } = await pool.query("SELECT * FROM usuarios WHERE lower(email) = lower($1)", [email]);
  return rows[0] || null;
}

async function findById(id, { comSenha = false } = {}) {
  const campos = comSenha ? `${CAMPOS_PUBLICOS}, senha_hash` : CAMPOS_PUBLICOS;
  const { rows } = await pool.query(`SELECT ${campos} FROM usuarios WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function create({ nome, email, senhaHash, isAdmin = false }) {
  const { rows } = await pool.query(
    `INSERT INTO usuarios (nome, email, senha_hash, is_admin) VALUES ($1, $2, $3, $4) RETURNING ${CAMPOS_PUBLICOS}`,
    [nome, email, senhaHash, isAdmin]
  );
  return rows[0];
}

async function updateNome(id, nome) {
  const { rows } = await pool.query(
    `UPDATE usuarios SET nome = $1, atualizado_em = now() WHERE id = $2 RETURNING ${CAMPOS_PUBLICOS}`,
    [nome, id]
  );
  return rows[0] || null;
}

/** Versao atual do token do usuario (null se o usuario nao existe mais). */
async function tokenVersion(id) {
  const { rows } = await pool.query("SELECT token_version FROM usuarios WHERE id = $1", [id]);
  return rows[0] ? rows[0].token_version : null;
}

/** Exclusao definitiva (LGPD): os resultados e certificados saem junto (ON DELETE CASCADE). */
async function remover(id) {
  const { rowCount } = await pool.query("DELETE FROM usuarios WHERE id = $1", [id]);
  return rowCount > 0;
}

module.exports = { findByEmail, findById, create, updateNome, tokenVersion, remover };
