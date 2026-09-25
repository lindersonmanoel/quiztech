"use strict";

const request = require("supertest");
const createApp = require("../src/app");
const pool = require("../src/database/pool");
const { version } = require("../package.json");
const { run: migrar } = require("../src/database/migrate");
const { semearAreas } = require("../src/database/seed");
const fs = require("fs");
const path = require("path");
const { prepararBanco } = require("./helpers");

const RAIZ = path.join(__dirname, "..", "..");
// Nomes dos icones SVG que o site sabe desenhar (frontend/js/icons.js).
const ICONES_DO_SITE = new Set([...fs.readFileSync(path.join(RAIZ, "frontend", "js", "icons.js"), "utf8").matchAll(/^\s+"([a-z0-9-]+)":\s*[\[A-Z]/gm)].map((m) => m[1]));

const app = createApp();

beforeAll(prepararBanco);
afterAll(() => pool.end());

describe("saude e versao", () => {
  test("/api/health responde sem consultar o banco", async () => {
    expect((await request(app).get("/api/health")).body).toEqual({ status: "ok", ambiente: "test" });
  });

  test("/api/health/ready confere o banco", async () => {
    expect((await request(app).get("/api/health/ready")).body).toEqual({ status: "ok", banco: "ok" });
  });

  test("/api/version traz versao do package.json, commit de 7 caracteres, ambiente e nao e' cacheada", async () => {
    process.env.GIT_COMMIT = "abc1234def5678";
    const res = await request(app).get("/api/version");
    expect(res.body).toEqual({ name: "QUIZ TECH", version, commit: "abc1234", environment: "test" });
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    delete process.env.GIT_COMMIT;
  });
});

describe("banco de dados", () => {
  test("migracoes sao idempotentes e ficam registradas", async () => {
    await migrar({ encerrarPool: false });
    await migrar({ encerrarPool: false });
    const { rows } = await pool.query("SELECT nome FROM _migrations ORDER BY nome");
    expect(rows.map((r) => r.nome)).toContain("001_init.sql");
    expect(new Set(rows.map((r) => r.nome)).size).toBe(rows.length);
  });

  test("o seed e' idempotente (nao duplica areas, quizzes nem perguntas)", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      expect(await semearAreas(client)).toBe(0);
      await client.query("COMMIT");
    } finally {
      client.release();
    }
    const { rows } = await pool.query("SELECT (SELECT COUNT(*)::int FROM categorias) AS c, (SELECT COUNT(*)::int FROM perguntas) AS p");
    expect(rows[0]).toEqual({ c: 32, p: 576 });
  });

  test("o seed cria so' as areas que faltam", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const criadas = await semearAreas(client, [
        { grupo: "Testes", nome: "Só Esta Área", slug: "teste-seed-parcial", icone: "code", descricao: "x",
          quiz: { titulo: "Quiz", descricao: "x", dificuldade: "facil", limite_tempo: 0 },
          perguntas: [{ texto: "Pergunta?", pontos: 10, correta: "sim", erradas: ["não", "talvez", "nunca"] }] },
      ]);
      expect(criadas).toBe(1);
      await client.query("ROLLBACK"); // nao deixa lixo
    } finally {
      client.release();
    }
  });

  test("restricoes do esquema: uma correta por pergunta, dificuldade valida, pontos entre 1 e 100, e-mail unico sem caixa", async () => {
    const { rows } = await pool.query("SELECT id FROM perguntas LIMIT 1");
    await expect(pool.query("INSERT INTO alternativas (pergunta_id, texto, correta) VALUES ($1, 'outra correta', true)", [rows[0].id]))
      .rejects.toMatchObject({ code: "23505" });
    await expect(pool.query("UPDATE quizzes SET dificuldade = 'absurda' WHERE id = (SELECT id FROM quizzes LIMIT 1)"))
      .rejects.toMatchObject({ code: "23514" });
    await expect(pool.query("UPDATE perguntas SET pontos = 101 WHERE id = $1", [rows[0].id])).rejects.toMatchObject({ code: "23514" });
    await pool.query("INSERT INTO usuarios (nome, email, senha_hash) VALUES ('A', 'Caixa@Exemplo.com', 'x')");
    await expect(pool.query("INSERT INTO usuarios (nome, email, senha_hash) VALUES ('B', 'caixa@exemplo.com', 'x')"))
      .rejects.toMatchObject({ code: "23505" });
    await pool.query("DELETE FROM usuarios WHERE lower(email) = 'caixa@exemplo.com'");
  });
});


describe("icones SVG das areas", () => {
  test("o site conhece pelo menos as 32 areas + os icones de interface", () => {
    expect(ICONES_DO_SITE.size).toBeGreaterThanOrEqual(38);
    expect(ICONES_DO_SITE.has("code")).toBe(true); // icone padrao
  });

  test("toda area do seed usa um icone SVG que existe (nada de emoji)", () => {
    const areas = JSON.parse(fs.readFileSync(path.join(RAIZ, "database", "seed", "areas.json"), "utf8"));
    const invalidos = areas.filter((a) => !ICONES_DO_SITE.has(a.icone)).map((a) => `${a.slug}: ${a.icone}`);
    expect(invalidos).toEqual([]);
    expect(new Set(areas.map((a) => a.icone)).size).toBe(areas.length); // um icone diferente por area
  });

  test("o banco so' guarda nomes de icones validos", async () => {
    const { rows } = await pool.query("SELECT slug, icone FROM categorias WHERE slug NOT LIKE 'teste-%'");
    expect(rows.filter((r) => !ICONES_DO_SITE.has(r.icone))).toEqual([]);
  });

  test("a migracao 002 troca o emoji antigo pelo nome do icone e nao mexe em categorias novas", async () => {
    await pool.query("UPDATE categorias SET icone = '🐍' WHERE slug = 'python'");
    await pool.query("INSERT INTO categorias (nome, slug, grupo, icone) VALUES ('Categoria Nova', 'teste-icone-novo', 'Testes', '🧪')");
    try {
      await pool.query(fs.readFileSync(path.join(RAIZ, "database", "migrations", "002_icones_svg.sql"), "utf8"));
      expect((await pool.query("SELECT icone FROM categorias WHERE slug = 'python'")).rows[0].icone).toBe("python");
      expect((await pool.query("SELECT icone FROM categorias WHERE slug = 'teste-icone-novo'")).rows[0].icone).toBe("🧪");
    } finally {
      await pool.query("DELETE FROM categorias WHERE slug = 'teste-icone-novo'");
    }
  });
});

describe("PWA e site estatico", () => {
  const FRONT = path.join(RAIZ, "frontend");
  const sw = fs.readFileSync(path.join(FRONT, "service-worker.js"), "utf8");
  const emCache = [...sw.match(/const ARQUIVOS = \[([\s\S]*?)\];/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);

  test("o service worker guarda TODAS as paginas e scripts do site (senao a pagina nova nao abre offline)", () => {
    const paginas = fs.readdirSync(FRONT).filter((n) => n.endsWith(".html"));
    const scripts = fs.readdirSync(path.join(FRONT, "js")).map((n) => `js/${n}`);
    expect([...paginas, ...scripts].filter((f) => !emCache.includes(f))).toEqual([]);
    expect(emCache.filter((f) => f !== "./" && !fs.existsSync(path.join(FRONT, f)))).toEqual([]);
  });

  test("toda pagina carrega config.js e o manifesto, e nenhuma usa script inline (CSP)", () => {
    for (const nome of fs.readdirSync(FRONT).filter((n) => n.endsWith(".html") && n !== "offline.html")) { // a pagina offline nao usa a API
      const html = fs.readFileSync(path.join(FRONT, nome), "utf8");
      expect([nome, html.includes('src="js/config.js"')]).toEqual([nome, true]);
      expect([nome, html.includes('rel="manifest"')]).toEqual([nome, true]);
      const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/g)];
      expect([nome, inline.length]).toEqual([nome, 0]);
    }
  });

  test("o manifesto e' valido e os atalhos apontam para paginas que existem", () => {
    const m = JSON.parse(fs.readFileSync(path.join(FRONT, "manifest.webmanifest"), "utf8"));
    expect(m.display).toBe("standalone");
    for (const atalho of m.shortcuts) expect(fs.existsSync(path.join(FRONT, atalho.url.split("?")[0]))).toBe(true);
  });

  test("a pagina de redefinir senha nao vaza o token pelo Referer", () => {
    const html = fs.readFileSync(path.join(FRONT, "redefinir-senha.html"), "utf8");
    expect(html).toContain('name="referrer" content="no-referrer"');
  });
});
