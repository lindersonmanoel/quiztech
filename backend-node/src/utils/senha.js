"use strict";

// Hash de senha com bcrypt NATIVO (@node-rs/bcrypt, escrito em Rust): roda fora da thread principal do Node,
// entao varios logins/cadastros ao mesmo tempo nao travam o resto da API.
const bcrypt = require("@node-rs/bcrypt");

module.exports = {
  /** Gera o hash (assincrono). custo = rodadas (12 em producao). */
  hash: (senha, custo) => bcrypt.hash(senha, custo),
  /** Confere a senha contra um hash existente. */
  compare: (senha, hash) => bcrypt.compare(senha, hash),
  /** Versao sincrona (so' pra montar constantes na subida). */
  hashSync: (senha, custo) => bcrypt.hashSync(senha, custo),
};
