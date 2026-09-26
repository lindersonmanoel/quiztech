"use strict";

// Carga inicial do catalogo:
//  1) uma categoria e um quiz (nivel "medio") por area de tecnologia: database/seed/areas.json;
//  2) os quizzes de nivel facil e dificil de cada area: database/seed/niveis/*.json.
// Tudo e' idempotente: so' cria o que ainda nao existe (da' para acrescentar areas e niveis depois sem apagar nada).

const fs = require("fs");
const path = require("path");
const pool = require("./pool");

const SEED_DIR = path.join(__dirname, "..", "..", "..", "database", "seed");
const AREAS_JSON = path.join(SEED_DIR, "areas.json");
const NIVEIS_DIR = path.join(SEED_DIR, "niveis");

const ROTULO_NIVEL = { facil: "Fácil", media: "Médio", dificil: "Difícil" };
// Pontos por posicao da pergunta (as perguntas sao 6; o aproveitamento e' por acertos, os pontos alimentam o ranking).
const PONTOS_NIVEL = { facil: [10, 10, 10, 10, 10, 10], dificil: [20, 20, 30, 30, 40, 40] };
const TEMPO_NIVEL = { facil: 300, dificil: 420 }; // segundos

/** Le todos os arquivos de niveis e junta em { slug: { facil: [...], dificil: [...] } }. */
function carregarNiveis(dir = NIVEIS_DIR) {
  const niveis = {};
  if (!fs.existsSync(dir)) return niveis;
  for (const arquivo of fs.readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) {
    Object.assign(niveis, JSON.parse(fs.readFileSync(path.join(dir, arquivo), "utf8")));
  }
  return niveis;
}

async function inserirPerguntas(client, quizId, perguntas) {
  for (const [posicao, p] of perguntas.entries()) {
    const pergunta = await client.query(
      "INSERT INTO perguntas (quiz_id, texto, pontos, posicao) VALUES ($1, $2, $3, $4) RETURNING id",
      [quizId, p.texto, p.pontos, posicao]
    );
    await client.query("INSERT INTO alternativas (pergunta_id, texto, correta) VALUES ($1, $2, true)", [pergunta.rows[0].id, p.correta]);
    for (const errada of p.erradas) {
      await client.query("INSERT INTO alternativas (pergunta_id, texto, correta) VALUES ($1, $2, false)", [pergunta.rows[0].id, errada]);
    }
  }
}

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
    await inserirPerguntas(client, quiz.rows[0].id, area.perguntas);
    criadas += 1;
  }

  // Bancos criados antes dos niveis tem "Quiz de X"; o catalogo agora se chama "Quiz de X (Médio)".
  // So' renomeia quando o titulo ainda e' exatamente o original (nao mexe no que o administrador editou).
  for (const area of areas) {
    const novo = area.quiz.titulo;
    if (!novo.endsWith(` (${ROTULO_NIVEL.media})`)) continue;
    await client.query(
      `UPDATE quizzes q SET titulo = $1
         FROM categorias c
        WHERE c.id = q.categoria_id AND c.slug = $2 AND q.dificuldade = 'media' AND q.titulo = $3`,
      [novo, area.slug, novo.slice(0, -` (${ROTULO_NIVEL.media})`.length)]
    );
  }
  return criadas;
}

/**
 * Cria os quizzes de nivel facil e dificil que ainda nao foram criados. `seed_niveis` lembra o que ja foi criado:
 * se o administrador apagar ou desativar um quiz do catalogo, ele nao volta a cada deploy.
 * `niveis` e' { slug: { facil: [[enunciado, correta, [erradas...]], ...], dificil: [...] } }. Devolve quantos quizzes criou.
 */
async function semearNiveis(client, niveis = carregarNiveis()) {
  const { rows: feitos } = await client.query("SELECT chave FROM seed_niveis");
  const jaFeitos = new Set(feitos.map((r) => r.chave));
  const { rows: cats } = await client.query("SELECT id, slug, nome, descricao FROM categorias");
  const porSlug = new Map(cats.map((c) => [c.slug, c]));
  let criados = 0;

  for (const [slug, porNivel] of Object.entries(niveis)) {
    const cat = porSlug.get(slug);
    if (!cat) continue; // area removida pelo administrador
    for (const nivel of ["facil", "dificil"]) {
      const lista = porNivel[nivel];
      const chave = `${slug}:${nivel}`;
      if (!lista || jaFeitos.has(chave)) continue;
      const descricao = nivel === "facil"
        ? `Nível fácil de ${cat.nome}: os conceitos básicos para começar com segurança.`
        : `Nível difícil de ${cat.nome}: questões avançadas para quem já domina o básico.`;
      const quiz = await client.query(
        `INSERT INTO quizzes (titulo, descricao, categoria_id, dificuldade, limite_tempo)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [`Quiz de ${cat.nome} (${ROTULO_NIVEL[nivel]})`, descricao, cat.id, nivel, TEMPO_NIVEL[nivel]]
      );
      await inserirPerguntas(client, quiz.rows[0].id, lista.map(([texto, correta, erradas], i) => ({
        texto, correta, erradas, pontos: PONTOS_NIVEL[nivel][i],
      })));
      await client.query("INSERT INTO seed_niveis (chave) VALUES ($1)", [chave]);
      criados += 1;
    }
  }
  return criados;
}

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const criadas = await semearAreas(client);
    const niveis = await semearNiveis(client);
    await client.query("COMMIT");
    console.log(`[seed] ${criadas} area(s) e ${niveis} quiz(zes) de nível criado(s).`);
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

module.exports = { semearAreas, semearNiveis, carregarNiveis, run, PONTOS_NIVEL, TEMPO_NIVEL };
