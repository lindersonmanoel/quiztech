"use strict";

const resultadoService = require("../services/resultado.service");
const { AppError } = require("../utils/errors");
const { idDaRota, inteiroOpcional } = require("../utils/params");

const PERIODOS = { all: null, week: "week", month: "month" };
const NIVEIS = ["facil", "media", "dificil"];

async function listar(req, res, next) {
  try {
    return res.json(await resultadoService.listar(req.usuarioId));
  } catch (err) {
    return next(err);
  }
}

async function detalhe(req, res, next) {
  try {
    return res.json(await resultadoService.detalhe(idDaRota(req.params.id, "Resultado"), req.usuarioId));
  } catch (err) {
    return next(err);
  }
}

async function ranking(req, res, next) {
  try {
    const categoriaId = inteiroOpcional(req.query.category_id, "category_id");
    const quizId = inteiroOpcional(req.query.quiz_id, "quiz_id");
    const limite = Math.min(Math.max(inteiroOpcional(req.query.limit, "limit") || 50, 1), 100);
    const periodoInformado = req.query.period === undefined || req.query.period === "" ? "all" : String(req.query.period);
    if (!Object.hasOwn(PERIODOS, periodoInformado)) throw new AppError("Parâmetro inválido.", 422, { period: "Use all, week ou month." });
    const dificuldade = req.query.difficulty === undefined || req.query.difficulty === "" ? null : String(req.query.difficulty);
    if (dificuldade !== null && !NIVEIS.includes(dificuldade)) {
      throw new AppError("Parâmetro inválido.", 422, { difficulty: "Use facil, media ou dificil." });
    }
    return res.json(await resultadoService.ranking({ categoriaId, quizId, dificuldade, periodo: PERIODOS[periodoInformado], limite }));
  } catch (err) {
    return next(err);
  }
}

async function certificados(req, res, next) {
  try {
    return res.json(await resultadoService.certificadosDoUsuario(req.usuarioId));
  } catch (err) {
    return next(err);
  }
}

async function verificarCertificado(req, res, next) {
  try {
    return res.json(await resultadoService.verificarCertificado(req.params.codigo));
  } catch (err) {
    return next(err);
  }
}

async function qrCertificado(req, res, next) {
  try {
    const svg = await resultadoService.qrDoCertificado(req.params.codigo);
    res.set("Cache-Control", "public, max-age=86400");
    return res.type("image/svg+xml").send(svg);
  } catch (err) {
    return next(err);
  }
}

module.exports = { listar, detalhe, ranking, certificados, verificarCertificado, qrCertificado };
