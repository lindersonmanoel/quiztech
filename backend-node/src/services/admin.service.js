"use strict";

const pool = require("../database/pool");
const categoriaModel = require("../models/categoria.model");
const quizModel = require("../models/quiz.model");
const { AppError } = require("../utils/errors");
const { apresentarResumo } = require("./quiz.service");

async function estatisticas() {
  const { rows } = await pool.query(
    `SELECT (SELECT COUNT(*)::int FROM usuarios) AS users,
            (SELECT COUNT(*)::int FROM categorias) AS categories,
            (SELECT COUNT(*)::int FROM quizzes) AS quizzes,
            (SELECT COUNT(*)::int FROM perguntas) AS questions,
            (SELECT COUNT(*)::int FROM resultados) AS results,
            (SELECT COUNT(*)::int FROM certificados) AS certificates`
  );
  return rows[0];
}

function apresentarCategoria(c, quizCount = 0) {
  return { id: c.id, name: c.nome, slug: c.slug, group: c.grupo, icon: c.icone, description: c.descricao, quiz_count: quizCount };
}

async function criarCategoria(dados) {
  return apresentarCategoria(await categoriaModel.criar(dados));
}

async function atualizarCategoria(id, dados) {
  const c = await categoriaModel.atualizar(id, dados);
  if (!c) throw new AppError("Categoria não encontrada.", 404);
  return apresentarCategoria(c);
}

async function excluirCategoria(id) {
  if (!(await categoriaModel.buscarPorId(id))) throw new AppError("Categoria não encontrada.", 404);
  if (await categoriaModel.temResultados(id)) {
    throw new AppError("Há resultados nesta categoria; desative os quizzes em vez de excluir.", 409);
  }
  await categoriaModel.excluir(id);
}

async function criarQuiz(dados) {
  if (!(await categoriaModel.buscarPorId(dados.categoriaId))) throw new AppError("Categoria não encontrada.", 404);
  const id = await quizModel.criar(dados);
  return apresentarResumo(await quizModel.buscarResumo(id, { somenteAtivo: false }));
}

async function atualizarQuiz(id, dados) {
  if (!(await quizModel.buscarResumo(id, { somenteAtivo: false }))) throw new AppError("Quiz não encontrado.", 404);
  if (!(await categoriaModel.buscarPorId(dados.categoriaId))) throw new AppError("Categoria não encontrada.", 404);
  await quizModel.atualizar(id, dados);
  return apresentarResumo(await quizModel.buscarResumo(id, { somenteAtivo: false }));
}

/** Com historico (resultados/certificados apontando para ele) o quiz so' e' desativado, nunca apagado. */
async function excluirQuiz(id) {
  if (!(await quizModel.buscarResumo(id, { somenteAtivo: false }))) throw new AppError("Quiz não encontrado.", 404);
  if ((await quizModel.contarResultados(id)) > 0) await quizModel.desativar(id);
  else await quizModel.excluir(id);
}

async function criarPergunta(dados) {
  if (!(await quizModel.buscarResumo(dados.quizId, { somenteAtivo: false }))) throw new AppError("Quiz não encontrado.", 404);
  return { id: await quizModel.criarPergunta(dados) };
}

async function excluirPergunta(id) {
  if (!(await quizModel.excluirPergunta(id))) throw new AppError("Pergunta não encontrada.", 404);
}

module.exports = {
  estatisticas, criarCategoria, atualizarCategoria, excluirCategoria, criarQuiz, atualizarQuiz, excluirQuiz,
  criarPergunta, excluirPergunta,
};
