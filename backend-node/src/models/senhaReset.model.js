"use strict";

const crypto = require("crypto");
const pool = require("../database/pool");

/** O banco guarda so' o hash do token; o token em si existe apenas no e-mail enviado. */
const hashDoToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");

/** Cria o pedido e invalida os pedidos anteriores ainda abertos do mesmo usuario (vale sempre o ultimo link). */
async function criar(usuarioId, token, minutos) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE senha_resets SET usado_em = now() WHERE usuario_id = $1 AND usado_em IS NULL", [usuarioId]);
    await client.query(
      "INSERT INTO senha_resets (usuario_id, token_hash, expira_em) VALUES ($1, $2, now() + make_interval(mins => $3))",
      [usuarioId, hashDoToken(token), minutos]
    );
    // Limpeza: pedidos vencidos ha mais de um dia nao servem para nada.
    await client.query("DELETE FROM senha_resets WHERE expira_em < now() - interval '1 day'");
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Busca (e trava, na transacao do chamador) um pedido ainda valido: nao usado e nao vencido. */
async function buscarValidoParaUso(client, token) {
  const { rows } = await client.query(
    "SELECT id, usuario_id FROM senha_resets WHERE token_hash = $1 AND usado_em IS NULL AND expira_em > now() FOR UPDATE",
    [hashDoToken(token)]
  );
  return rows[0] || null;
}

module.exports = { hashDoToken, criar, buscarValidoParaUso };
