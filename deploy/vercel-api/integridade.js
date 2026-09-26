"use strict";

// Rota de verificacao do deploy (GET /api/integridade): devolve o SHA-1 de cada arquivo publicado, para comparar com os
// arquivos locais e provar que o que esta no ar e' exatamente o que foi enviado. Protegida por INTEGRITY_TOKEN
// (cabecalho x-integrity-token); sem o token responde 404. Nao expoe conteudo, so' hashes.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const sha1 = (arquivo) => crypto.createHash("sha1").update(fs.readFileSync(arquivo)).digest("hex");

module.exports = (req, res) => {
  const esperado = process.env.INTEGRITY_TOKEN || "";
  const recebido = String(req.headers["x-integrity-token"] || "");
  const iguais = esperado.length > 0 && recebido.length === esperado.length
    && crypto.timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado));
  if (!iguais) {
    res.statusCode = 404;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ erro: "Rota não encontrada." }));
    return;
  }
  const raiz = path.join(__dirname, "..");
  const saida = {};
  (function varrer(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const caminho = path.join(dir, item.name);
      if (item.isDirectory()) varrer(caminho);
      else saida[path.relative(raiz, caminho).split(path.sep).join("/")] = sha1(caminho);
    }
  }(path.join(raiz, "backend-node")));
  for (const arquivo of ["package.json", "vercel.json", "api/index.js"]) {
    if (fs.existsSync(path.join(raiz, arquivo))) saida[arquivo] = sha1(path.join(raiz, arquivo));
  }
  res.statusCode = 200;
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(saida));
};
