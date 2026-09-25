"use strict";

const { AppError } = require("../utils/errors");

const INT_MAX = 2147483647; // maior valor de um INTEGER do PostgreSQL

/** Converte "123" em 123; qualquer coisa fora de 1..INT_MAX vira erro 404 (evita 500 por valor fora do intervalo). */
function idDaRota(valor, rotulo = "Registro") {
  const n = Number(valor);
  if (!/^\d+$/.test(String(valor)) || !Number.isSafeInteger(n) || n < 1 || n > INT_MAX) {
    throw new AppError(`${rotulo} não encontrado(a).`, 404);
  }
  return n;
}

/** Query string opcional: devolve null se ausente; 422 se presente e invalida. */
function inteiroOpcional(valor, nome) {
  if (valor === undefined || valor === "") return null;
  const n = Number(valor);
  if (!/^\d+$/.test(String(valor)) || n < 1 || n > INT_MAX) {
    throw new AppError("Parâmetro inválido.", 422, { [nome]: "Valor inválido." });
  }
  return n;
}

module.exports = { idDaRota, inteiroOpcional };
