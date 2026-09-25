"use strict";

const config = require("../config");
const adminModel = require("../models/admin.model");
const categoriaModel = require("../models/categoria.model");
const quizModel = require("../models/quiz.model");
const { AppError } = require("../utils/errors");
const { apresentarResumo } = require("./quiz.service");

async function estatisticas() {
  return adminModel.estatisticas(config.rankingFuso, config.aprovacaoPercentual);
}

async function atividadeRecente() {
  return (await adminModel.atividadeRecente(15)).map((r) => ({
    id: r.id,
    user_name: r.usuario_nome,
    quiz_title: r.quiz_titulo,
    difficulty: r.dificuldade,
    percentage: r.percentual,
    passed: r.percentual >= config.aprovacaoPercentual,
    certificate: r.certificado,
    created_at: r.criado_em,
  }));
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

async function listarQuizzes(filtros) {
  return (await quizModel.listarTodos(filtros)).map((q) => ({ ...apresentarResumo(q), result_count: q.total_resultados }));
}

/** Quiz com as perguntas e a alternativa correta marcada (so' o administrador ve isto). */
async function detalheQuiz(id) {
  const quiz = await quizModel.buscarCompleto(id, { somenteAtivo: false });
  if (!quiz) throw new AppError("Quiz não encontrado.", 404);
  return {
    ...apresentarResumo(quiz),
    questions: quiz.perguntas.map((p) => ({
      id: p.id,
      text: p.texto,
      points: p.pontos,
      alternatives: p.alternativas.map((a) => ({ id: a.id, text: a.texto, is_correct: a.correta })),
    })),
  };
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

async function atualizarPergunta(id, dados) {
  if (!(await quizModel.atualizarPergunta(id, dados))) throw new AppError("Pergunta não encontrada.", 404);
  return { id };
}

async function excluirPergunta(id) {
  if (!(await quizModel.excluirPergunta(id))) throw new AppError("Pergunta não encontrada.", 404);
}

async function listarUsuarios({ busca, limite, deslocamento }) {
  return (await adminModel.listarUsuarios({ busca, limite, deslocamento })).map((u) => ({
    id: u.id,
    name: u.nome,
    email: u.email,
    is_admin: u.is_admin,
    created_at: u.criado_em,
    result_count: u.total_resultados,
    certificate_count: u.total_certificados,
  }));
}

/** Promove ou rebaixa. Ninguem altera o proprio acesso: assim o sistema nunca fica sem administrador. */
async function definirAdmin(alvoId, valor, atorId) {
  if (alvoId === atorId) throw new AppError("Você não pode alterar o seu próprio acesso.", 409);
  const u = await adminModel.definirAdmin(alvoId, valor);
  if (!u) throw new AppError("Usuário não encontrado.", 404);
  return { id: u.id, name: u.nome, email: u.email, is_admin: u.is_admin, created_at: u.criado_em };
}

module.exports = {
  estatisticas, atividadeRecente, criarCategoria, atualizarCategoria, excluirCategoria, listarQuizzes, detalheQuiz,
  criarQuiz, atualizarQuiz, excluirQuiz, criarPergunta, atualizarPergunta, excluirPergunta, listarUsuarios, definirAdmin,
};
