"use strict";

const fs = require("fs");
const path = require("path");
const request = require("supertest");
const createApp = require("../src/app");
const pool = require("../src/database/pool");
const { semearAreas, semearNiveis, carregarNiveis, PONTOS_NIVEL, TEMPO_NIVEL } = require("../src/database/seed");
const { prepararBanco, limparUsuarios, criarUsuario, quizIdDaArea, gabarito, respostasErradas } = require("./helpers");

const app = createApp();
const RAIZ = path.join(__dirname, "..", "..");
const TZ = "America/Sao_Paulo";
const INICIO_SEMANA = `(date_trunc('week', now() AT TIME ZONE '${TZ}') AT TIME ZONE '${TZ}')`;
const INICIO_MES = `(date_trunc('month', now() AT TIME ZONE '${TZ}') AT TIME ZONE '${TZ}')`;

beforeAll(prepararBanco);
beforeEach(limparUsuarios);
afterAll(() => pool.end());

async function aprovar(u, slug = "python", nivel = null) {
  const id = await quizIdDaArea(slug, nivel);
  const res = await request(app).post(`/api/quizzes/${id}/submit`).set(u.headers).send({ answers: await gabarito(id) });
  expect(res.status).toBe(201);
  return res.body;
}

const ranking = async (query = {}) => (await request(app).get("/api/ranking").query(query)).body;
const nomes = (linhas) => linhas.map((l) => l.user_name);

/** Um mesmo bloco de transacao que sempre desfaz: os testes de seed nao deixam rastro no banco compartilhado. */
async function emTransacaoDesfeita(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    return await fn(client);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
}

describe("conteudo dos niveis (seed)", () => {
  const areas = JSON.parse(fs.readFileSync(path.join(RAIZ, "database", "seed", "areas.json"), "utf8"));
  const niveis = carregarNiveis();

  test("as 32 areas tem quiz facil e dificil, com 6 perguntas de 1 certa + 3 erradas, sem repeticao", () => {
    expect(Object.keys(niveis).sort()).toEqual(areas.map((a) => a.slug).sort());
    const enunciados = new Set(areas.flatMap((a) => a.perguntas.map((p) => p.texto.trim().toLowerCase())));
    for (const area of areas) {
      for (const nivel of ["facil", "dificil"]) {
        const lista = niveis[area.slug][nivel];
        expect(lista).toHaveLength(6);
        for (const [texto, correta, erradas] of lista) {
          const rotulo = `${area.slug}/${nivel}: ${texto}`;
          expect([rotulo, typeof texto === "string" && texto.length >= 3 && texto.length <= 1000]).toEqual([rotulo, true]);
          expect([rotulo, erradas.length]).toEqual([rotulo, 3]);
          const todas = [correta, ...erradas].map((t) => t.trim().toLowerCase());
          expect([rotulo, new Set(todas).size]).toEqual([rotulo, 4]);
          expect([rotulo, todas.every((t) => t.length >= 1 && t.length <= 500)]).toEqual([rotulo, true]);
          const chave = texto.trim().toLowerCase();
          expect([rotulo, enunciados.has(chave)]).toEqual([rotulo, false]); // enunciado repetido (tambem entre niveis)
          enunciados.add(chave);
        }
      }
    }
  });

  test("a resposta certa nao e' quase sempre a mais longa (senao daria para passar so' pelo tamanho)", () => {
    let total = 0;
    let maisLonga = 0;
    for (const porNivel of Object.values(niveis)) {
      for (const lista of Object.values(porNivel)) {
        for (const [, correta, erradas] of lista) {
          total += 1;
          if (correta.length > Math.max(...erradas.map((e) => e.length))) maisLonga += 1;
        }
      }
    }
    expect(total).toBe(384);
    expect(maisLonga / total).toBeLessThan(0.45); // acaso puro seria ~25%
  });
});

describe("niveis no banco", () => {
  test("cada area tem 3 quizzes, com pontos e tempo por nivel", async () => {
    const { rows } = await pool.query(
      `SELECT q.dificuldade, COUNT(*)::int AS n, MIN(q.limite_tempo) AS tmin, MAX(q.limite_tempo) AS tmax,
              MIN(pt.total)::int AS pmin, MAX(pt.total)::int AS pmax
         FROM quizzes q JOIN (SELECT quiz_id, SUM(pontos) AS total FROM perguntas GROUP BY quiz_id) pt ON pt.quiz_id = q.id
        GROUP BY q.dificuldade ORDER BY q.dificuldade`
    );
    const somar = (l) => l.reduce((a, b) => a + b, 0);
    expect(rows).toEqual([
      { dificuldade: "dificil", n: 32, tmin: TEMPO_NIVEL.dificil, tmax: TEMPO_NIVEL.dificil, pmin: somar(PONTOS_NIVEL.dificil), pmax: somar(PONTOS_NIVEL.dificil) },
      { dificuldade: "facil", n: 32, tmin: TEMPO_NIVEL.facil, tmax: TEMPO_NIVEL.facil, pmin: somar(PONTOS_NIVEL.facil), pmax: somar(PONTOS_NIVEL.facil) },
      { dificuldade: "media", n: 32, tmin: 300, tmax: 300, pmin: 120, pmax: 120 },
    ]);
  });

  test("a carga dos niveis e' idempotente", async () => {
    await emTransacaoDesfeita(async (client) => {
      expect(await semearNiveis(client)).toBe(0);
      const { rows } = await client.query("SELECT COUNT(*)::int AS n FROM quizzes");
      expect(rows[0].n).toBe(96);
    });
  });

  test("quiz de nivel apagado pelo administrador nao volta a cada deploy; sem o registro, volta", async () => {
    await emTransacaoDesfeita(async (client) => {
      await client.query(
        "DELETE FROM quizzes WHERE dificuldade = 'facil' AND categoria_id = (SELECT id FROM categorias WHERE slug = 'python')"
      );
      expect(await semearNiveis(client)).toBe(0);
      expect((await client.query("SELECT COUNT(*)::int AS n FROM quizzes q JOIN categorias c ON c.id = q.categoria_id WHERE c.slug = 'python'")).rows[0].n).toBe(2);

      await client.query("DELETE FROM seed_niveis WHERE chave = 'python:facil'");
      expect(await semearNiveis(client)).toBe(1);
      expect((await client.query("SELECT COUNT(*)::int AS n FROM quizzes q JOIN categorias c ON c.id = q.categoria_id WHERE c.slug = 'python'")).rows[0].n).toBe(3);
    });
  });

  test("area removida do banco e' ignorada pela carga dos niveis", async () => {
    await emTransacaoDesfeita(async (client) => {
      const criados = await semearNiveis(client, { "area-que-nao-existe": { facil: [["P?", "a", ["b", "c", "d"]]] } });
      expect(criados).toBe(0);
    });
  });

  test("banco antigo: o quiz 'Quiz de X' vira 'Quiz de X — Médio' so' se o titulo ainda for o original", async () => {
    await emTransacaoDesfeita(async (client) => {
      await client.query(
        `UPDATE quizzes SET titulo = 'Quiz de Python' WHERE dificuldade = 'media' AND categoria_id = (SELECT id FROM categorias WHERE slug = 'python')`
      );
      await client.query(
        `UPDATE quizzes SET titulo = 'Titulo que o admin escolheu' WHERE dificuldade = 'media' AND categoria_id = (SELECT id FROM categorias WHERE slug = 'java')`
      );
      await semearAreas(client);
      const titulo = async (slug) => (await client.query(
        "SELECT titulo FROM quizzes q JOIN categorias c ON c.id = q.categoria_id WHERE c.slug = $1 AND q.dificuldade = 'media'", [slug]
      )).rows[0].titulo;
      expect(await titulo("python")).toBe("Quiz de Python — Médio");
      expect(await titulo("java")).toBe("Titulo que o admin escolheu");
    });
  });

  test("o nivel aparece no quiz, no resultado e no certificado", async () => {
    const u = await criarUsuario(app, { name: "Bruno Almeida" });
    for (const nivel of ["facil", "media", "dificil"]) {
      const r = await aprovar(u, "redes-de-computadores", nivel);
      expect(r.difficulty).toBe(nivel);
      expect(r.certificate.difficulty).toBe(nivel);
      expect(r.certificate.quiz_title).toMatch(nivel === "facil" ? /Fácil$/ : nivel === "media" ? /Médio$/ : /Difícil$/);
      const detalhe = await request(app).get(`/api/results/${r.id}`).set(u.headers);
      expect(detalhe.body.difficulty).toBe(nivel);
    }
    const lista = await request(app).get("/api/results").set(u.headers);
    expect(lista.body.map((r) => r.difficulty).sort()).toEqual(["dificil", "facil", "media"]);
    // Um certificado por nivel (unico por usuario + quiz).
    expect((await request(app).get("/api/certificates").set(u.headers)).body).toHaveLength(3);
  });

  test("os pontos do quiz dificil valem mais no ranking", async () => {
    const f = await criarUsuario(app, { name: "Fabio Facil" });
    const d = await criarUsuario(app, { name: "Diana Dificil" });
    await aprovar(f, "python", "facil");
    await aprovar(d, "python", "dificil");
    const linhas = await ranking({ category_id: (await request(app).get("/api/categories")).body.find((c) => c.slug === "python").id });
    expect(linhas.map((l) => [l.user_name, l.total_score])).toEqual([["Diana D.", 180], ["Fabio F.", 60]]);
  });
});

describe("ranking semanal e mensal", () => {
  async function cenario() {
    const agora = await criarUsuario(app, { name: "Ana Agora" });
    const semanaPassada = await criarUsuario(app, { name: "Paulo Passado" });
    const mesPassado = await criarUsuario(app, { name: "Marta Mensal" });
    await aprovar(agora);
    await aprovar(semanaPassada);
    await aprovar(mesPassado);
    await pool.query(`UPDATE resultados SET criado_em = ${INICIO_SEMANA} - interval '1 minute' WHERE usuario_id = $1`, [semanaPassada.usuario.id]);
    await pool.query(`UPDATE resultados SET criado_em = ${INICIO_MES} - interval '1 minute' WHERE usuario_id = $1`, [mesPassado.usuario.id]);
    return { agora, semanaPassada, mesPassado };
  }

  test("period=all (padrao) soma tudo; week deixa de fora o que veio antes da segunda; month, o que veio antes do dia 1", async () => {
    await cenario();
    expect(nomes(await ranking()).sort()).toEqual(["Ana A.", "Marta M.", "Paulo P."]);
    expect(nomes(await ranking({ period: "all" })).sort()).toEqual(["Ana A.", "Marta M.", "Paulo P."]);

    const semana = nomes(await ranking({ period: "week" }));
    expect(semana).toContain("Ana A.");
    expect(semana).not.toContain("Paulo P."); // resultado de 1 minuto antes do inicio da semana

    const mes = nomes(await ranking({ period: "month" }));
    expect(mes).toContain("Ana A.");
    expect(mes).not.toContain("Marta M."); // resultado de 1 minuto antes do inicio do mes
  });

  test("dentro do periodo conta a melhor pontuacao do periodo, nao a de antes", async () => {
    const u = await criarUsuario(app, { name: "Rita Recorde" });
    await aprovar(u); // 120 pontos...
    await pool.query(`UPDATE resultados SET criado_em = ${INICIO_SEMANA} - interval '1 hour' WHERE usuario_id = $1`, [u.usuario.id]);
    // ...e agora uma tentativa fraca, dentro da semana.
    const id = await quizIdDaArea("python");
    const errado = await request(app).post(`/api/quizzes/${id}/submit`).set(u.headers).send({ answers: await respostasErradas(id) });
    expect(errado.status).toBe(201);

    const geral = await ranking({ period: "all" });
    expect(geral.find((l) => l.user_name === "Rita R.").total_score).toBe(120);
    const semana = await ranking({ period: "week" });
    expect(semana.find((l) => l.user_name === "Rita R.").total_score).toBe(0);
  });

  test("period=week funciona junto com area e nivel", async () => {
    const u = await criarUsuario(app, { name: "Carla Combinada" });
    await aprovar(u, "python", "facil");
    await aprovar(u, "javascript", "dificil");
    const cats = (await request(app).get("/api/categories")).body;
    const python = cats.find((c) => c.slug === "python");
    expect((await ranking({ period: "week", category_id: python.id }))[0].total_score).toBe(60);
    expect((await ranking({ period: "week", difficulty: "dificil" }))[0].total_score).toBe(180);
    expect((await ranking({ period: "week", difficulty: "media" }))).toEqual([]);
    expect((await ranking({ period: "month", difficulty: "facil" }))[0].total_score).toBe(60);
  });

  test("parametros invalidos = 422", async () => {
    for (const query of [{ period: "year" }, { period: "WEEK" }, { period: "__proto__" }, { difficulty: "impossivel" }, { difficulty: "FACIL" }]) {
      const res = await request(app).get("/api/ranking").query(query);
      expect([JSON.stringify(query), res.status]).toEqual([JSON.stringify(query), 422]);
    }
    expect((await request(app).get("/api/ranking").query({ period: "" })).status).toBe(200);
  });

  test("nao vaza dados: so' o nome abreviado, nunca e-mail", async () => {
    const { agora } = await cenario();
    for (const period of ["all", "week", "month"]) {
      const corpo = JSON.stringify(await ranking({ period }));
      expect(corpo).not.toContain(agora.dados.email);
      expect(corpo).not.toContain("Agora");
    }
  });
});

describe("QR Code do certificado", () => {
  // O supertest so' preenche res.text para tipos de texto; image/svg+xml chega como Buffer em res.body.
  const corpo = (res) => (Buffer.isBuffer(res.body) ? res.body.toString("utf8") : res.text);

  test("GET /certificates/:codigo/qr.svg devolve um SVG publico (sem login) e cacheavel", async () => {
    const u = await criarUsuario(app, { name: "Ana Souza Lima" });
    const r = await aprovar(u);
    const res = await request(app).get(`/api/certificates/${r.certificate.code}/qr.svg`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^image\/svg\+xml/);
    expect(res.headers["cache-control"]).toMatch(/max-age=\d+/);
    expect(corpo(res).startsWith("<?xml") || corpo(res).startsWith("<svg")).toBe(true);
    expect(corpo(res)).toContain("<svg");
    expect(corpo(res)).not.toContain("<script");
    // O codigo e' aceito em qualquer caixa, como na consulta publica.
    expect(corpo(await request(app).get(`/api/certificates/${r.certificate.code.toLowerCase()}/qr.svg`))).toBe(corpo(res));
  });

  test("cada certificado tem o seu QR; codigo inexistente = 404", async () => {
    const u = await criarUsuario(app);
    const a = await aprovar(u, "python");
    const b = await aprovar(u, "java");
    const qrA = corpo(await request(app).get(`/api/certificates/${a.certificate.code}/qr.svg`));
    const qrB = corpo(await request(app).get(`/api/certificates/${b.certificate.code}/qr.svg`));
    expect(qrA).not.toBe(qrB);
    const inexistente = await request(app).get("/api/certificates/QT-NAOEXISTE/qr.svg");
    expect(inexistente.status).toBe(404);
    expect(inexistente.body.erro).toMatch(/não encontrado/);
  });

  test("o QR aponta para a pagina de verificacao do site (config.appUrl), e nao para um endereco vindo da requisicao", async () => {
    const QRCode = require("qrcode");
    const config = require("../src/config");
    const u = await criarUsuario(app);
    const r = await aprovar(u);
    const esperado = await QRCode.toString(`${config.appUrl}/certificado.html?code=${encodeURIComponent(r.certificate.code)}`, {
      type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" },
    });
    const res = await request(app).get(`/api/certificates/${r.certificate.code}/qr.svg`).set("Host", "site-malicioso.example").set("X-Forwarded-Host", "outro.example");
    expect(corpo(res)).toBe(esperado);
  });
});
