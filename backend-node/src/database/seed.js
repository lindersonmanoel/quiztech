"use strict";

// Carga inicial: uma categoria e um quiz por area de tecnologia (database/seed/areas.json).
// Idempotente por slug: so' cria as areas que ainda nao existem (da' para acrescentar areas depois sem apagar nada).

const fs = require("fs");
const path = require("path");
const pool = require("./pool");

const AREAS_JSON = path.join(__dirname, "..", "..", "..", "database", "seed", "areas.json");

/** Insere as areas que faltam usando o `client` informado (o chamador controla a transacao). Devolve quantas criou. */
async function semearAreas(client, areas = JSON.parse(fs.readFileSync(AREAS_JSON, "utf8"))) {
  const { rows } = await client.query("SELECT slug FROM categorias");
  const existentes = new Set(rows.map((r) => r.slug));
  let criadas = 0;

  for (const area of areas) {
    if (existentes.has(area.slug)) continue;
    const cat = await client.query(
      "INSERT INTO categorias (nome, slug, grupo, icone, descricao) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [area.nome, area.slug, area.grupo, area.icone, area.descricao]
    );
    const quiz = await client.query(
      `INSERT INTO quizzes (titulo, descricao, categoria_id, dificuldade, limite_tempo)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [area.quiz.titulo, area.quiz.descricao, cat.rows[0].id, area.quiz.dificuldade, area.quiz.limite_tempo]
    );
    for (const [posicao, p] of area.perguntas.entries()) {
      const pergunta = await client.query(
        "INSERT INTO perguntas (quiz_id, texto, pontos, posicao) VALUES ($1, $2, $3, $4) RETURNING id",
        [quiz.rows[0].id, p.texto, p.pontos, posicao]
      );
      await client.query("INSERT INTO alternativas (pergunta_id, texto, correta) VALUES ($1, $2, true)", [pergunta.rows[0].id, p.correta]);
      for (const errada of p.erradas) {
        await client.query("INSERT INTO alternativas (pergunta_id, texto, correta) VALUES ($1, $2, false)", [pergunta.rows[0].id, errada]);
      }
    }
    criadas += 1;
  }
  return criadas;
}

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const criadas = await semearAreas(client);
    await client.query("COMMIT");
    console.log(`[seed] ${criadas} area(s) criada(s).`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  run().catch((err) => {
    console.error("[seed] erro:", err.message);
    process.exitCode = 1;
  });
}

module.exports = { semearAreas, run };
