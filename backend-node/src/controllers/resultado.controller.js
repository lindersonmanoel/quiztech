"use strict";

const resultadoService = require("../services/resultado.service");
const { idDaRota, inteiroOpcional } = require("../utils/params");

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
    return res.json(await resultadoService.ranking({ categoriaId, quizId, limite }));
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

module.exports = { listar, detalhe, ranking, certificados, verificarCertificado };
