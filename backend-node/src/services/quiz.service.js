"use strict";

const crypto = require("crypto");
const config = require("../config");
const pool = require("../database/pool");
const categoriaModel = require("../models/categoria.model");
const quizModel = require("../models/quiz.model");
const resultadoModel = require("../models/resultado.model");
const certificadoModel = require("../models/certificado.model");
const { AppError } = require("../utils/errors");
const { embaralhar } = require("../utils/publico");
const { revisaoPublica, apresentarCertificado } = require("./apresentacao");

function apresentarResumo(q) {
  return {
    id: q.id,
    title: q.titulo,
    description: q.descricao,
    category_id: q.categoria_id,
    category_name: q.categoria_nome,
    difficulty: q.dificuldade,
    is_active: q.ativo,
    time_limit: q.limite_tempo,
    question_count: q.total_perguntas,
    total_points: q.total_pontos,
  };
}

async function categorias() {
  const rows = await categoriaModel.listarComContagem();
  return rows.map((c) => ({
    id: c.id, name: c.nome, slug: c.slug, group: c.grupo, icon: c.icone, description: c.descricao, quiz_count: c.quiz_count,
  }));
}

async function listar({ categoriaId, busca }) {
  return (await quizModel.listarAtivos({ categoriaId, busca })).map(apresentarResumo);
}

/** Depois de reprovar, e' preciso esperar antes de refazer (a menos que o usuario ja tenha o certificado). */
async function exigirIntervalo(usuarioId, quizId) {
  if (!config.refazerEsperaSegundos) return;
  if (await certificadoModel.existe(usuarioId, quizId)) return;
  const ultimo = await resultadoModel.ultimoDoUsuario(usuarioId, quizId);
  if (!ultimo || ultimo.percentual >= config.aprovacaoPercentual) return;
  const restanteMs = new Date(ultimo.criado_em).getTime() + config.refazerEsperaSegundos * 1000 - Date.now();
  if (restanteMs > 0) {
    const segundos = Math.ceil(restanteMs / 1000);
    throw new AppError(
      `Aguarde ${Math.ceil(segundos / 60)} min para refazer este quiz. Recomenda-se revisar o conteúdo nesse intervalo.`,
      429, null, { retryAfter: segundos }
    );
  }
}

/** Devolve o quiz SEM indicar a alternativa correta; a ordem das alternativas e' embaralhada. */
async function detalhe(quizId, usuarioId = null) {
  const quiz = await quizModel.buscarCompleto(quizId);
  if (!quiz) throw new AppError("Quiz não encontrado.", 404);
  if (usuarioId) await exigirIntervalo(usuarioId, quiz.id); // avisa antes de o usuario gastar tempo respondendo
  return {
    ...apresentarResumo(quiz),
    questions: quiz.perguntas.map((p) => ({
      id: p.id,
      text: p.texto,
      points: p.pontos,
      alternatives: embaralhar(p.alternativas).map((a) => ({ id: a.id, text: a.texto })),
    })),
  };
}

function novoCodigoCertificado() {
  const hex = (n) => crypto.randomBytes(n).toString("hex").toUpperCase();
  return `QT-${hex(4)}-${hex(2)}`;
}

/** Corrige no servidor: o cliente nunca recebe o gabarito antes de responder. */
async function submeter(usuarioId, quizId, { answers, tempoGasto }) {
  const quiz = await quizModel.buscarCompleto(quizId);
  if (!quiz) throw new AppError("Quiz não encontrado.", 404);
  await exigirIntervalo(usuarioId, quiz.id);

  const escolhas = new Map(answers.map((a) => [a.question_id, a.alternative_id ?? null]));
  const revisao = [];
  let pontos = 0;
  let pontosMaximos = 0;
  let acertos = 0;

  for (const pergunta of quiz.perguntas) {
    const certa = pergunta.alternativas.find((a) => a.correta);
    // find() so' acha alternativas DESTA pergunta: id inexistente ou de outra pergunta = sem resposta.
    const escolhida = pergunta.alternativas.find((a) => a.id === escolhas.get(pergunta.id)) || null;
    const acertou = Boolean(escolhida && escolhida.correta);
    pontosMaximos += pergunta.pontos;
    if (acertou) {
      pontos += pergunta.pontos;
      acertos += 1;
    }
    revisao.push({
      question_id: pergunta.id,
      question: pergunta.texto,
      points: pergunta.pontos,
      chosen_id: escolhida ? escolhida.id : null,
      chosen_text: escolhida ? escolhida.texto : null,
      correct_id: certa.id,
      correct_text: certa.texto,
      is_correct: acertou,
    });
  }

  const total = quiz.perguntas.length;
  const percentual = total ? Math.round((acertos / total) * 1000) / 10 : 0;
  const aprovado = percentual >= config.aprovacaoPercentual;
  const tempo = quiz.limite_tempo ? Math.min(tempoGasto, quiz.limite_tempo) : tempoGasto;

  const client = await pool.connect();
  let resultado;
  let certificado = null;
  try {
    await client.query("BEGIN");
    resultado = await resultadoModel.criar(client, {
      usuarioId, quizId: quiz.id, pontos, pontosMaximos, acertos, erros: total - acertos, percentual, tempoGasto: tempo, revisao,
    });
    if (aprovado) {
      await certificadoModel.emitir(client, {
        codigo: novoCodigoCertificado(), usuarioId, quizId: quiz.id, resultadoId: resultado.id, pontos, percentual,
      });
      certificado = await certificadoModel.buscarDoUsuarioNoQuiz(usuarioId, quiz.id, client);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return {
    id: resultado.id,
    quiz_id: quiz.id,
    quiz_title: quiz.titulo,
    difficulty: quiz.dificuldade,
    score: pontos,
    max_score: pontosMaximos,
    correct_answers: acertos,
    wrong_answers: total - acertos,
    percentage: percentual,
    time_spent: tempo,
    passed: aprovado,
    created_at: resultado.criado_em,
    review: revisaoPublica(revisao, aprovado),
    certificate: certificado ? apresentarCertificado(certificado) : null,
  };
}

module.exports = { categorias, listar, detalhe, submeter, apresentarResumo };
