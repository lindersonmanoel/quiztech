"use strict";

const quizService = require("../services/quiz.service");
const { AppError } = require("../utils/errors");
const { idDaRota, inteiroOpcional } = require("../utils/params");
const { validateSubmit } = require("../utils/validators");

async function categorias(_req, res, next) {
  try {
    return res.json(await quizService.categorias());
  } catch (err) {
    return next(err);
  }
}

async function listar(req, res, next) {
  try {
    const categoriaId = inteiroOpcional(req.query.category_id, "category_id");
    const busca = req.query.q ? String(req.query.q).slice(0, 80) : null;
    return res.json(await quizService.listar({ categoriaId, busca }));
  } catch (err) {
    return next(err);
  }
}

async function detalhe(req, res, next) {
  try {
    return res.json(await quizService.detalhe(idDaRota(req.params.id, "Quiz"), req.usuarioId || null));
  } catch (err) {
    return next(err);
  }
}

async function submeter(req, res, next) {
  try {
    const quizId = idDaRota(req.params.id, "Quiz");
    const { valido, erros, answers, tempoGasto } = validateSubmit(req.body || {});
    if (!valido) throw new AppError("Dados inválidos.", 422, erros);
    return res.status(201).json(await quizService.submeter(req.usuarioId, quizId, { answers, tempoGasto }));
  } catch (err) {
    return next(err);
  }
}

module.exports = { categorias, listar, detalhe, submeter };
