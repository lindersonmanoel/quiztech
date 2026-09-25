"use strict";

const QRCode = require("qrcode");
const config = require("../config");
const resultadoModel = require("../models/resultado.model");
const certificadoModel = require("../models/certificado.model");
const { AppError } = require("../utils/errors");
const { nomePublico } = require("../utils/publico");
const { apresentarResumoResultado, apresentarResultadoCompleto, apresentarCertificado } = require("./apresentacao");

async function listar(usuarioId) {
  return (await resultadoModel.listarDoUsuario(usuarioId)).map(apresentarResumoResultado);
}

async function detalhe(id, usuarioId) {
  const r = await resultadoModel.buscarDoUsuario(id, usuarioId);
  if (!r) throw new AppError("Resultado não encontrado.", 404);
  return apresentarResultadoCompleto(r, await certificadoModel.buscarPorResultado(r.id));
}

async function ranking({ categoriaId, quizId, dificuldade, periodo, limite }) {
  const rows = await resultadoModel.ranking({ categoriaId, quizId, dificuldade, periodo, fuso: config.rankingFuso, limite });
  return rows.map((r, i) => ({
    position: i + 1,
    user_name: nomePublico(r.nome),
    total_score: r.total,
    quizzes_completed: r.quizzes,
  }));
}

async function certificadosDoUsuario(usuarioId) {
  return (await certificadoModel.listarDoUsuario(usuarioId)).map(apresentarCertificado);
}

/** Consulta publica por codigo (autenticidade). Nao expoe o e-mail. */
async function verificarCertificado(codigo) {
  const c = await certificadoModel.buscarPorCodigo(String(codigo).trim().toUpperCase());
  if (!c) throw new AppError("Certificado não encontrado.", 404);
  return apresentarCertificado(c);
}

/** QR Code (SVG) que aponta para a pagina publica de verificacao do certificado. */
async function qrDoCertificado(codigo) {
  const c = await certificadoModel.buscarPorCodigo(String(codigo).trim().toUpperCase());
  if (!c) throw new AppError("Certificado não encontrado.", 404);
  const url = `${config.appUrl}/certificado.html?code=${encodeURIComponent(c.codigo)}`;
  return QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
}

module.exports = { listar, detalhe, ranking, certificadosDoUsuario, verificarCertificado, qrDoCertificado };
