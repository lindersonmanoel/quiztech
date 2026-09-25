"use strict";

// Carrega backend-node/.env.test antes de qualquer teste (e antes de src/config.js ler process.env), pra usar um banco
// e um segredo separados dos de desenvolvimento. No CI as variaveis vem do workflow (o arquivo nao existe).
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.test") });
process.env.NODE_ENV = "test";
process.env.ADMIN_EMAIL = "admin@example.com";
process.env.JWT_SECRET = process.env.JWT_SECRET || "segredo-so-para-testes-com-mais-de-32-caracteres";
