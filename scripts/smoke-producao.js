#!/usr/bin/env node
"use strict";

// Teste de fumaca da PRODUCAO: confere que o site e a API estao no ar e configurados como esperado.
// So' faz leituras (GET e um preflight CORS): nao cria usuario nem grava dado.
//   FRONTEND_URL=https://... API_URL=https://... node scripts/smoke-producao.js
// Sai com codigo 1 se algo falhar (o CI avisa por e-mail).

const FRONTEND_URL = (process.env.FRONTEND_URL || "https://quiztech-lindersonmanoel.vercel.app").replace(/\/+$/, "");
const API_URL = (process.env.API_URL || "https://quiztech.tailfdf602.ts.net").replace(/\/+$/, "");

let falhas = 0;
function verificar(rotulo, ok, detalhe = "") {
  if (!ok) falhas += 1;
  console.log(`${ok ? "OK   " : "FALHA"} ${rotulo}${detalhe ? ` (${detalhe})` : ""}`);
}

async function buscar(url, opcoes = {}) {
  const controle = new AbortController();
  const t = setTimeout(() => controle.abort(), 15000);
  try {
    return await fetch(url, { ...opcoes, signal: controle.signal });
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  console.log(`Site: ${FRONTEND_URL}\nAPI:  ${API_URL}\n`);

  // ---- Site (Vercel) ----
  try {
    const home = await buscar(`${FRONTEND_URL}/`);
    const html = await home.text();
    verificar("site abre (200, HTML)", home.status === 200 && /text\/html/.test(home.headers.get("content-type") || ""), `HTTP ${home.status}`);
    verificar("site referencia o manifesto e o config.js", html.includes("manifest.webmanifest") && html.includes("js/config.js"));
    const csp = home.headers.get("content-security-policy") || "";
    verificar("CSP libera a API (connect-src) e nada de script inline", csp.includes(new URL(API_URL).origin) && !/script-src[^;]*unsafe-inline/.test(csp));
    verificar("cabecalhos de seguranca (nosniff, frame-ancestors)", home.headers.get("x-content-type-options") === "nosniff" && csp.includes("frame-ancestors 'none'"));
    const man = await buscar(`${FRONTEND_URL}/manifest.webmanifest`);
    const manifesto = man.ok ? await man.json() : {};
    verificar("manifesto PWA valido", man.ok && manifesto.display === "standalone" && Array.isArray(manifesto.icons) && manifesto.icons.length >= 3);
    const sw = await buscar(`${FRONTEND_URL}/service-worker.js`);
    verificar("service worker sem cache longo", sw.ok && /no-cache|max-age=0/.test(sw.headers.get("cache-control") || ""));
  } catch (erro) {
    verificar("site acessivel", false, erro.message);
  }

  // ---- API ----
  try {
    const saude = await buscar(`${API_URL}/api/health/ready`);
    const corpo = await saude.json();
    verificar("API e banco no ar (/api/health/ready)", saude.status === 200 && corpo.status === "ok" && corpo.banco === "ok");

    const versao = await (await buscar(`${API_URL}/api/version`)).json();
    verificar("versao publicada", /^\d+\.\d+\.\d+$/.test(versao.version || ""), `v${versao.version} ${versao.commit} ${versao.environment}`);
    verificar("API em modo producao", versao.environment === "production");

    const cats = await (await buscar(`${API_URL}/api/categories`)).json();
    verificar("areas carregadas", Array.isArray(cats) && cats.length >= 32, `${cats.length} areas`);

    const rk = await buscar(`${API_URL}/api/ranking`);
    verificar("ranking responde", rk.status === 200);

    // CORS: o site pode chamar a API; um site qualquer nao.
    const permitido = await buscar(`${API_URL}/api/categories`, { headers: { Origin: FRONTEND_URL } });
    verificar("CORS libera o site", permitido.headers.get("access-control-allow-origin") === FRONTEND_URL);
    const bloqueado = await buscar(`${API_URL}/api/categories`, { headers: { Origin: "https://site-malicioso.example" } });
    verificar("CORS bloqueia outras origens", bloqueado.status === 403 && !bloqueado.headers.get("access-control-allow-origin"));

    const admin = await buscar(`${API_URL}/api/admin/stats`);
    verificar("rotas de administracao exigem login", admin.status === 401);
    const docs = await buscar(`${API_URL}/docs`);
    verificar("nada de documentacao/debug exposto", docs.status === 404);
  } catch (erro) {
    verificar("API acessivel", false, erro.message);
  }

  console.log(falhas ? `\n${falhas} verificacao(oes) falhou(aram).` : "\nTudo certo.");
  process.exit(falhas ? 1 : 0);
}

main();
