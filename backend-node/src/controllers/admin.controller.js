"use strict";

const adminService = require("../services/admin.service");
const { AppError } = require("../utils/errors");
const { idDaRota, inteiroOpcional } = require("../utils/params");
const { validateCategoria, validateQuiz, validatePergunta } = require("../utils/validators");

const NIVEIS = ["facil", "media", "dificil"];

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

const textoOpcional = (v) => (v === undefined || v === "" ? null : String(v).slice(0, 80));

module.exports = {
  estatisticas: envolver(async (_req, res) => res.json(await adminService.estatisticas())),
  atividade: envolver(async (_req, res) => res.json(await adminService.atividadeRecente())),
  criarCategoria: envolver(async (req, res) => res.status(201).json(await adminService.criarCategoria(validar(validateCategoria(req.body))))),
  atualizarCategoria: envolver(async (req, res) =>
    res.json(await adminService.atualizarCategoria(idDaRota(req.params.id, "Categoria"), validar(validateCategoria(req.body))))),
  excluirCategoria: envolver(async (req, res) => {
    await adminService.excluirCategoria(idDaRota(req.params.id, "Categoria"));
    res.status(204).end();
  }),
  listarQuizzes: envolver(async (req, res) => {
    const dificuldade = textoOpcional(req.query.difficulty);
    if (dificuldade !== null && !NIVEIS.includes(dificuldade)) {
      throw new AppError("Parâmetro inválido.", 422, { difficulty: "Use facil, media ou dificil." });
    }
    res.json(await adminService.listarQuizzes({
      categoriaId: inteiroOpcional(req.query.category_id, "category_id"), dificuldade, busca: textoOpcional(req.query.q),
    }));
  }),
  detalheQuiz: envolver(async (req, res) => res.json(await adminService.detalheQuiz(idDaRota(req.params.id, "Quiz")))),
  criarQuiz: envolver(async (req, res) => res.status(201).json(await adminService.criarQuiz(validar(validateQuiz(req.body))))),
  atualizarQuiz: envolver(async (req, res) =>
    res.json(await adminService.atualizarQuiz(idDaRota(req.params.id, "Quiz"), validar(validateQuiz(req.body))))),
  excluirQuiz: envolver(async (req, res) => {
    await adminService.excluirQuiz(idDaRota(req.params.id, "Quiz"));
    res.status(204).end();
  }),
  criarPergunta: envolver(async (req, res) => res.status(201).json(await adminService.criarPergunta(validar(validatePergunta(req.body))))),
  atualizarPergunta: envolver(async (req, res) => {
    const dados = validar(validatePergunta(req.body, { exigeQuiz: false }));
    res.json(await adminService.atualizarPergunta(idDaRota(req.params.id, "Pergunta"), dados));
  }),
  excluirPergunta: envolver(async (req, res) => {
    await adminService.excluirPergunta(idDaRota(req.params.id, "Pergunta"));
    res.status(204).end();
  }),
  listarUsuarios: envolver(async (req, res) => {
    const limite = Math.min(inteiroOpcional(req.query.limit, "limit") || 50, 200);
    const pagina = inteiroOpcional(req.query.page, "page") || 1;
    res.json(await adminService.listarUsuarios({ busca: textoOpcional(req.query.q), limite, deslocamento: (pagina - 1) * limite }));
  }),
  definirAdmin: envolver(async (req, res) => {
    if (typeof (req.body || {}).is_admin !== "boolean") throw new AppError("Dados inválidos.", 422, { is_admin: "Informe true ou false." });
    res.json(await adminService.definirAdmin(idDaRota(req.params.id, "Usuário"), req.body.is_admin, req.usuarioId));
  }),
};
