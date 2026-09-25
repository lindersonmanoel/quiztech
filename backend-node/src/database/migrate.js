"use strict";

// Corredor de migracao simples (mesmo do Meu Bolso Digital): aplica, em ordem, os arquivos .sql de
// database/migrations ainda nao aplicados e registra cada um na tabela de controle _migrations.

const fs = require("fs");
const path = require("path");
const pool = require("./pool");

const MIGRATIONS_DIR = path.join(__dirname, "..", "..", "..", "database", "migrations");
// Numero da trava (advisory lock) do PostgreSQL; diferente do usado por outros projetos no mesmo servidor.
const MIGRATION_LOCK_ID = 727310;

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      nome        VARCHAR(200) PRIMARY KEY,
      aplicada_em TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function run({ encerrarPool = true } = {}) {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".sql")).sort();
  if (!files.length) {
    console.log("[migrate] nenhum arquivo de migracao encontrado em", MIGRATIONS_DIR);
    return;
  }

  const client = await pool.connect();
  const avisar = (aviso) => console.warn(`[migrate] aviso do banco: ${aviso.message}`);
  client.on("notice", avisar);
  try {
    await client.query("SET statement_timeout = 0");
    // Duas instancias subindo juntas nao aplicam a mesma migracao ao mesmo tempo.
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
    await ensureMigrationsTable(client);
    const { rows } = await client.query("SELECT nome FROM _migrations");
    const applied = new Set(rows.map((r) => r.nome));

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`[migrate] ja aplicada: ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      console.log(`[migrate] aplicando: ${file}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO _migrations (nome) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`Falha ao aplicar ${file}: ${err.message}`);
      }
    }
    console.log("[migrate] concluido.");
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]).catch(() => {});
    client.removeListener("notice", avisar); // a conexao volta ao pool: nao deixa o ouvinte preso nela
    client.release();
    if (encerrarPool) await pool.end();
  }
}

if (require.main === module) {
  run().catch((err) => {
    console.error("[migrate] erro:", err.message);
    process.exitCode = 1;
  });
}

module.exports = { run };
