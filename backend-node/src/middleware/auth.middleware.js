"use strict";

const authService = require("../services/auth.service");
const usuarioModel = require("../models/usuario.model");
const { AppError } = require("../utils/errors");

function extrairToken(req) {
  const header = req.headers.authorization || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

/** Valida assinatura/validade E confere no banco que o usuario ainda existe e que a versao do token e' a atual. */
async function validarToken(token) {
  const { sub, tv } = authService.decodificarToken(token);
  const usuarioId = Number(sub);
  const versaoAtual = Number.isInteger(usuarioId) ? await usuarioModel.tokenVersion(usuarioId) : null;
  if (versaoAtual === null || (tv || 0) !== versaoAtual) {
    throw new authService.AuthError("Sessão inválida ou expirada. Faça login novamente.", 401);
  }
  return usuarioId;
}

/** Exige Authorization: Bearer <token> valido; preenche req.usuarioId. */
async function requireAuth(req, _res, next) {
  const token = extrairToken(req);
  if (!token) return next(new authService.AuthError("Token de acesso ausente. Faça login.", 401));
  try {
    req.usuarioId = await validarToken(token);
    return next();
  } catch (err) {
    return next(err);
  }
}

/** Rotas publicas que se comportam melhor com usuario logado: token ausente ou invalido = anonimo. */
async function optionalAuth(req, _res, next) {
  const token = extrairToken(req);
  if (token) {
    try {
      req.usuarioId = await validarToken(token);
    } catch (err) {
      /* anonimo */
    }
  }
  return next();
}

/** Use DEPOIS de requireAuth. */
async function requireAdmin(req, _res, next) {
  try {
    const usuario = await usuarioModel.findById(req.usuarioId);
    if (!usuario || !usuario.is_admin) throw new AppError("Acesso restrito a administradores.", 403);
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { requireAuth, optionalAuth, requireAdmin };
