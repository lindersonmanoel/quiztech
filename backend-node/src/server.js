"use strict";

const config = require("./config");
const createApp = require("./app");
const pool = require("./database/pool");
const { version } = require("./version");

const app = createApp();

if (config.isProduction && !require("./services/email.service").configurado()) {
  // eslint-disable-next-line no-console
  console.warn("[config] SMTP_HOST não definido: a recuperação de senha por e-mail fica desativada (veja DEPLOY.md, seção de e-mail).");
}

const server = app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] QUIZ TECH API v${version} rodando na porta ${config.port} (ambiente: ${config.nodeEnv})`);
});

// Encerramento gracioso: como o Node roda como PID 1 no container, sem tratar SIGTERM o "docker stop" esperava 10 s e
// matava o processo no meio das requisicoes. Agora para de aceitar conexoes novas, deixa terminar as em andamento,
// fecha o pool do banco e sai.
let encerrando = false;
function encerrar(sinal, codigo = 0) {
  if (encerrando) return;
  encerrando = true;
  // eslint-disable-next-line no-console
  console.log(`[server] ${sinal} recebido, encerrando...`);
  setTimeout(() => process.exit(1), 10000).unref();
  server.close(() => {
    pool.end().catch(() => {}).finally(() => process.exit(codigo));
  });
  if (typeof server.closeIdleConnections === "function") server.closeIdleConnections();
}
process.on("SIGTERM", () => encerrar("SIGTERM"));
process.on("SIGINT", () => encerrar("SIGINT"));

process.on("unhandledRejection", (motivo) => {
  // eslint-disable-next-line no-console
  console.error("[server] promessa rejeitada sem tratamento:", motivo);
});
process.on("uncaughtException", (err) => {
  // eslint-disable-next-line no-console
  console.error("[server] exceção não tratada:", err);
  encerrar("uncaughtException", 1);
});
