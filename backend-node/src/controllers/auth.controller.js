"use strict";

const authService = require("../services/auth.service");
const usuarioModel = require("../models/usuario.model");
const { AppError } = require("../utils/errors");
const { validateRegister, validateLogin, validateNomePerfil } = require("../utils/validators");

function dadosInvalidos(erros) {
  return new AppError("Dados inválidos.", 422, erros);
}

async function register(req, res, next) {
  try {
    const { valido, erros, nome, email } = validateRegister(req.body || {});
    if (!valido) throw dadosInvalidos(erros);
    return res.status(201).json(await authService.registrar({ nome, email, senha: req.body.password }));
  } catch (err) {
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const { valido, erros, email } = validateLogin(req.body || {});
    if (!valido) throw dadosInvalidos(erros);
    return res.json(await authService.autenticar({ email, senha: req.body.password }));
  } catch (err) {
    return next(err);
  }
}

async function me(req, res, next) {
  try {
    const usuario = await usuarioModel.findById(req.usuarioId);
    if (!usuario) throw new AppError("Usuário não encontrado.", 404);
    return res.json(authService.apresentarUsuario(usuario));
  } catch (err) {
    return next(err);
  }
}

async function updateMe(req, res, next) {
  try {
    const { valido, erros, nome } = validateNomePerfil(req.body || {});
    if (!valido) throw dadosInvalidos(erros);
    return res.json(await authService.atualizarNome(req.usuarioId, nome));
  } catch (err) {
    return next(err);
  }
}

async function deleteMe(req, res, next) {
  try {
    const senha = (req.body || {}).password;
    if (!senha || typeof senha !== "string") throw dadosInvalidos({ password: "Informe a senha." });
    await authService.excluirConta(req.usuarioId, senha);
    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
}

module.exports = { register, login, me, updateMe, deleteMe };
