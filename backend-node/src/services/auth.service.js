"use strict";

const crypto = require("crypto");
const bcrypt = require("../utils/senha");
const jwt = require("jsonwebtoken");
const config = require("../config");
const pool = require("../database/pool");
const usuarioModel = require("../models/usuario.model");
const senhaResetModel = require("../models/senhaReset.model");
const emailService = require("./email.service");
const { emSegundoPlano } = require("../utils/segundoPlano");
const { AppError } = require("../utils/errors");

// Em teste o custo minimo do bcrypt (4) deixa a suite bem mais rapida; producao segue com 12.
const SALT_ROUNDS = config.isTest ? 4 : 12;

class AuthError extends AppError {
  constructor(message, statusCode = 400, campo = null) {
    super(message, statusCode, campo ? { [campo]: message } : null);
    this.campo = campo;
  }
}

// Algoritmo fixado na assinatura E na verificacao (nao aceita o que o cabecalho do token disser).
const JWT_ALGORITMO = "HS256";

// Hash de uma senha qualquer: o login compara contra ele quando o e-mail nao existe, gastando o mesmo tempo de
// bcrypt para nao revelar (pelo tempo de resposta) quais e-mails tem conta.
const HASH_FALSO = bcrypt.hashSync("senha-que-nao-pertence-a-ninguem", SALT_ROUNDS);

function apresentarUsuario(u) {
  return { id: u.id, name: u.nome, email: u.email, is_admin: u.is_admin };
}

function assinarToken(usuario, tokenVersion = 0) {
  return jwt.sign({ sub: String(usuario.id), tv: tokenVersion }, config.jwtSecret, {
    algorithm: JWT_ALGORITMO,
    expiresIn: config.jwtExpiresIn,
  });
}

/** Le e valida a assinatura/validade do token. Devolve o payload ({ sub, tv, ... }). */
function decodificarToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret, { algorithms: [JWT_ALGORITMO] });
  } catch (err) {
    throw new AuthError("Sessão inválida ou expirada. Faça login novamente.", 401);
  }
}

function respostaDeSessao(registro) {
  return {
    access_token: assinarToken(registro, registro.token_version || 0),
    token_type: "bearer",
    user: apresentarUsuario(registro),
  };
}

async function registrar({ nome, email, senha }) {
  const existente = await usuarioModel.findByEmail(email);
  if (existente) throw new AuthError("E-mail já cadastrado.", 409, "email");

  const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);
  const usuario = await usuarioModel.create({
    nome, email, senhaHash,
    isAdmin: Boolean(config.adminEmail) && email === config.adminEmail,
  });
  return respostaDeSessao({ ...usuario, token_version: 0 });
}

async function autenticar({ email, senha }) {
  // Mensagem generica de proposito: nao revela se o e-mail existe.
  const registro = await usuarioModel.findByEmail(email);
  const confere = await bcrypt.compare(senha, registro ? registro.senha_hash : HASH_FALSO);
  if (!registro || !confere) throw new AuthError("E-mail ou senha inválidos.", 401);
  return respostaDeSessao(registro);
}

async function atualizarNome(usuarioId, nome) {
  const usuario = await usuarioModel.updateNome(usuarioId, nome);
  if (!usuario) throw new AuthError("Usuário não encontrado.", 404);
  return apresentarUsuario(usuario);
}

/** Direito de exclusao (LGPD): confirma a senha e apaga conta, resultados e certificados. */
async function excluirConta(usuarioId, senha) {
  const registro = await usuarioModel.findById(usuarioId, { comSenha: true });
  if (!registro) throw new AuthError("Usuário não encontrado.", 404);
  const confere = await bcrypt.compare(senha, registro.senha_hash);
  // 403 (e nao 401): o frontend nao pode interpretar como sessao expirada.
  if (!confere) throw new AppError("Senha incorreta.", 403, { password: "Senha incorreta." });
  await usuarioModel.remover(usuarioId);
}

/**
 * Esqueci a senha: se o e-mail tem conta, gera um link de uso unico e envia. Quem chama responde SEMPRE a mesma coisa
 * (exista a conta ou nao) e nao espera esta funcao: assim nem a resposta nem o tempo dela revelam quais e-mails tem conta.
 */
async function solicitarRedefinicao(email) {
  const usuario = await usuarioModel.findByEmail(email);
  if (!usuario) return;
  const token = crypto.randomBytes(32).toString("base64url");
  await senhaResetModel.criar(usuario.id, token, config.resetMinutos);
  // O token vai no fragmento (#): ele nao e' enviado ao servidor do site nem aparece em logs ou no Referer.
  const link = `${config.appUrl}/redefinir-senha.html#token=${token}`;
  await emailService.enviarRedefinicaoDeSenha({ para: usuario.email, nome: usuario.nome, link, minutos: config.resetMinutos });
}

/** Define a senha nova com o token do e-mail. Uso unico; encerra as sessoes abertas. */
async function redefinirSenha({ token, senha }) {
  const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);
  const client = await pool.connect();
  let usuario;
  try {
    await client.query("BEGIN");
    const pedido = await senhaResetModel.buscarValidoParaUso(client, token);
    if (!pedido) {
      throw new AuthError("Este link é inválido ou já venceu. Peça um novo em \"Esqueci minha senha\".", 400, "token");
    }
    usuario = await usuarioModel.atualizarSenha(client, pedido.usuario_id, senhaHash);
    await client.query("UPDATE senha_resets SET usado_em = now() WHERE usuario_id = $1 AND usado_em IS NULL", [pedido.usuario_id]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  if (usuario) {
    emSegundoPlano(emailService.enviarSenhaAlterada({ para: usuario.email, nome: usuario.nome }), "aviso de senha alterada");
  }
}

module.exports = {
  AuthError, apresentarUsuario, assinarToken, decodificarToken, registrar, autenticar, atualizarNome, excluirConta,
  solicitarRedefinicao, redefinirSenha,
};
