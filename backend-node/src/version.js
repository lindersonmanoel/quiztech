"use strict";

// A versao vem do package.json (fonte unica). O commit vem do build (Docker: ARG GIT_COMMIT), do Vercel (Git) ou embutido no pacote (QT_COMMIT, veja scripts/empacotar-api-vercel.js).
const { version } = require("../package.json");
const config = require("./config");

function buildInfo() {
  const commit = process.env.GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || process.env.COMMIT_SHA || process.env.QT_COMMIT || "dev";
  return {
    name: "QUIZ TECH",
    version,
    commit: String(commit).slice(0, 7),
    environment: config.nodeEnv,
  };
}

module.exports = { version, buildInfo };
