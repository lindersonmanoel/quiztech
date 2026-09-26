#!/usr/bin/env node
"use strict";

// Monta a pasta dist-api/ com a API pronta para o Vercel (funcao sem servidor), a partir de backend-node/.
//   node scripts/empacotar-api-vercel.js
// Todo o codigo da API vira UM arquivo (api/index.js, minificado); as dependencias continuam sendo instaladas pelo
// Vercel a partir do package.json. Depois, publique dist-api/ como projeto do Vercel (ex.: `npx vercel deploy --prod`
// dentro de dist-api/). As variaveis de ambiente estao em DEPLOY.md (secao "API no Vercel + Supabase").
//
// Estrutura gerada:
//   dist-api/api/index.js    codigo da API + app Express como funcao (rotas /api/*)
//   dist-api/package.json    dependencias de producao
//   dist-api/vercel.json     rota /api/* -> funcao

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const RAIZ = path.join(__dirname, "..");
const ORIGEM = path.join(RAIZ, "backend-node");
const DESTINO = path.join(RAIZ, "dist-api");

let esbuild;
try {
  esbuild = require(path.join(ORIGEM, "node_modules", "esbuild"));
} catch (e) {
  console.error("Falha ao carregar o esbuild (rode `npm install` em backend-node/).");
  process.exit(1);
}

fs.rmSync(DESTINO, { recursive: true, force: true });
fs.mkdirSync(path.join(DESTINO, "api"), { recursive: true });

let commit = "dev";
try {
  commit = execSync("git rev-parse --short HEAD", { cwd: RAIZ }).toString().trim();
} catch (e) { /* fora do Git: fica "dev" */ }

esbuild.buildSync({
  entryPoints: [path.join(ORIGEM, "src", "entradaVercel.js")],
  bundle: true,
  minify: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  packages: "external",
  legalComments: "none",
  define: { "process.env.QT_COMMIT": JSON.stringify(commit) },
  outfile: path.join(DESTINO, "api", "index.js"),
  logLevel: "warning",
});

const pkg = JSON.parse(fs.readFileSync(path.join(ORIGEM, "package.json"), "utf8"));
const enxuto = { name: "quiztech-api-vercel", version: pkg.version, private: true, engines: { node: "22.x" }, dependencies: pkg.dependencies };
fs.writeFileSync(path.join(DESTINO, "package.json"), `${JSON.stringify(enxuto, null, 2)}\n`);

fs.copyFileSync(path.join(RAIZ, "deploy", "vercel-api", "integridade.js"), path.join(DESTINO, "api", "integridade.js"));
fs.writeFileSync(path.join(DESTINO, "vercel.json"), `${JSON.stringify({
  $schema: "https://openapi.vercel.sh/vercel.json",
  framework: null,
  functions: { "api/index.js": { maxDuration: 30 }, "api/integridade.js": { includeFiles: "backend-node/**" } },
  rewrites: [{ source: "/api/(.*)", destination: "/api/index.js" }],
}, null, 2)}\n`);

const tamanho = fs.statSync(path.join(DESTINO, "api", "index.js")).size;
console.log(`dist-api/ pronto: versao ${pkg.version}, commit ${commit}, api/index.js com ${(tamanho / 1024).toFixed(0)} KB`);
