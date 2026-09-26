"use strict";

// Entrada da funcao do Vercel: o proprio app Express (as rotas ja comecam em /api).
// scripts/empacotar-api-vercel.js junta este arquivo e todo o codigo da API em um unico api/index.js.
module.exports = require("./app")();
