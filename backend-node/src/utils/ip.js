"use strict";

const crypto = require("crypto");
const config = require("../config");

/** IP do visitante. Se CLIENT_IP_HEADER estiver configurado (proxy confiavel, ex.: cf-connecting-ip), usa esse
 * cabecalho; senao, o IP resolvido pelo Express ("trust proxy"). */
function clientIp(req) {
  if (config.clientIpHeader) {
    const valor = req.headers[config.clientIpHeader];
    if (valor) return String(valor).split(",")[0].trim();
  }
  return req.ip || (req.socket && req.socket.remoteAddress) || "?";
}

/** Chave opaca (hash) para os limitadores: nao guarda IP nem e-mail em memoria/log. */
function chave(...partes) {
  return crypto.createHash("sha256").update(partes.join("|")).digest("hex");
}

module.exports = { clientIp, chave };
