"use strict";

// Converte linhas do banco (portugues) no formato JSON da API (ingles, snake_case) que o frontend usa.

const config = require("../config");

/** So' quem foi aprovado ve o gabarito; os demais veem apenas quais respostas estavam certas. */
function revisaoPublica(revisao, aprovado) {
  if (aprovado) return revisao;
  return revisao.map((item) => ({ ...item, correct_id: null, correct_text: null }));
}

function apresentarCertificado(c) {
  return {
    code: c.codigo,
    user_name: c.usuario_nome,
    quiz_id: c.quiz_id,
    quiz_title: c.quiz_titulo,
    category_name: c.categoria_nome,
    score: c.pontos,
    percentage: c.percentual,
    issued_at: c.emitido_em,
  };
}

function aprovado(percentual) {
  return percentual >= config.aprovacaoPercentual;
}

function apresentarResumoResultado(r) {
  return {
    id: r.id,
    quiz_id: r.quiz_id,
    quiz_title: r.quiz_titulo,
    score: r.pontos,
    max_score: r.pontos_maximos,
    percentage: r.percentual,
    passed: aprovado(r.percentual),
    created_at: r.criado_em,
  };
}

function apresentarResultadoCompleto(r, certificado) {
  const passou = aprovado(r.percentual);
  return {
    id: r.id,
    quiz_id: r.quiz_id,
    quiz_title: r.quiz_titulo,
    score: r.pontos,
    max_score: r.pontos_maximos,
    correct_answers: r.acertos,
    wrong_answers: r.erros,
    percentage: r.percentual,
    time_spent: r.tempo_gasto,
    passed: passou,
    created_at: r.criado_em,
    review: revisaoPublica(r.revisao, passou),
    certificate: certificado ? apresentarCertificado(certificado) : null,
  };
}

module.exports = { revisaoPublica, apresentarCertificado, apresentarResumoResultado, apresentarResultadoCompleto, aprovado };
