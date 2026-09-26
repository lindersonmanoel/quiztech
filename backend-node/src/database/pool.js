"use strict";

const { Pool } = require("pg");
const config = require("../config");

if (!config.databaseUrl) {
  throw new Error("DATABASE_URL não configurado. Preencha o .env (veja .env.example).");
}

// Sem DATABASE_SSL_CA, hosts gerenciados costumam usar certificado autoassinado e validar a cadeia derrubaria
// a conexao; se o provedor usa CA publica (ex.: Neon), defina DATABASE_SSL_VERIFY=true para validar mesmo assim. Na rede interna do Docker (padrao deste projeto) nao ha SSL: DATABASE_SSL=false.
const ssl = config.databaseSsl
  ? config.databaseSslCa
    ? { ca: config.databaseSslCa, rejectUnauthorized: true }
    : { rejectUnauthorized: config.databaseSslVerify }
  : false;

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl,
  // Em funcoes sem servidor cada instancia abre poucas conexoes (o pooler do banco multiplexa); no servidor fixo, 10.
  max: Number(process.env.DB_POOL_MAX) || (process.env.VERCEL ? 3 : 10),
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: process.env.VERCEL ? 10000 : 30000,
  statement_timeout: 30000, // uma consulta travada nao prende a conexao pra sempre (a migracao desliga isto)
});

pool.on("error", (err) => {
  // Erro numa conexao ociosa (ex.: banco reiniciou): nao deve derrubar o processo inteiro.
  // eslint-disable-next-line no-console
  console.error("[database] erro inesperado numa conexao ociosa do pool:", err.message);
});

module.exports = pool;
