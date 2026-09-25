"use strict";

const adminService = require("../services/admin.service");
const { AppError } = require("../utils/errors");
const { idDaRota } = require("../utils/params");
const { validateCategoria, validateQuiz, validatePergunta } = require("../utils/validators");

function validar(resultado) {
  if (!resultado.valido) throw new AppError("Dados inválidos.", 422, resultado.erros);
  return resultado.dados;
}

const envolver = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  estatisticas: envolver(async (_req, res) => res.json(await adminService.estatisticas())),
  criarCategoria: envolver(async (req, res) => res.status(201).json(await adminService.criarCategoria(validar(validateCategoria(req.body))))),
  atualizarCategoria: envolver(async (req, res) =>
    res.json(await adminService.atualizarCategoria(idDaRota(req.params.id, "Categoria"), validar(validateCategoria(req.body))))),
  excluirCategoria: envolver(async (req, res) => {
    await adminService.excluirCategoria(idDaRota(req.params.id, "Categoria"));
    res.status(204).end();
  }),
  criarQuiz: envolver(async (req, res) => res.status(201).json(await adminService.criarQuiz(validar(validateQuiz(req.body))))),
  atualizarQuiz: envolver(async (req, res) =>
    res.json(await adminService.atualizarQuiz(idDaRota(req.params.id, "Quiz"), validar(validateQuiz(req.body))))),
  excluirQuiz: envolver(async (req, res) => {
    await adminService.excluirQuiz(idDaRota(req.params.id, "Quiz"));
    res.status(204).end();
  }),
  criarPergunta: envolver(async (req, res) => res.status(201).json(await adminService.criarPergunta(validar(validatePergunta(req.body))))),
  excluirPergunta: envolver(async (req, res) => {
    await adminService.excluirPergunta(idDaRota(req.params.id, "Pergunta"));
    res.status(204).end();
  }),
};
