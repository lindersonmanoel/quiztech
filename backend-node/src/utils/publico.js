"use strict";

/** O ranking e' publico: mostra so' o primeiro nome e a inicial do ultimo sobrenome (o nome completo fica no certificado). */
function nomePublico(nomeCompleto) {
  const partes = String(nomeCompleto || "").split(/\s+/).filter(Boolean);
  if (!partes.length) return "Anônimo";
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[partes.length - 1][0].toUpperCase()}.`;
}

/** Embaralha (Fisher-Yates) sem alterar o original. */
function embaralhar(lista, aleatorio = require("crypto").randomInt) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = aleatorio(i + 1);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

module.exports = { nomePublico, embaralhar };
