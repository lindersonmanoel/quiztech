"use strict";

const rateLimit = require("express-rate-limit");
const config = require("../config");
const { clientIp, chave } = require("../utils/ip");
const { normalizeEmail } = require("../utils/validators");

const JANELA_MS = 15 * 60 * 1000;

/** Fabrica um limitador (janela de 15 min, contador em memoria: serve a uma unica instancia da API).
 * Em teste o limite sobe muito (a suite faz centenas de chamadas legitimas); o mecanismo em si e' verificado a parte,
 * passando `respeitarLimiteEmTeste: true`. */
function criarLimiter({
  limit, mensagem = "Muitas requisições. Aguarde alguns minutos e tente de novo.",
  keyGenerator, skipSuccessfulRequests = false, respeitarLimiteEmTeste = false,
}) {
  return rateLimit({
    windowMs: JANELA_MS,
    limit: config.isTest && !respeitarLimiteEmTeste ? 100000 : limit,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    keyGenerator: keyGenerator || ((req) => chave("geral", clientIp(req))),
    message: { erro: mensagem },
  });
}

const emailDoCorpo = (req) => normalizeEmail(req.body && req.body.email);
const MSG_TENTATIVAS = "Muitas tentativas. Tente novamente em alguns minutos.";

/** Limitadores das rotas de conta. `opcoes` permite baixar os tetos nos testes. */
function criarLimitadoresAuth({ testar = false, ipLimite = 5, emailLimite = 20, cadastroLimite = 10, exclusaoLimite = 5 } = {}) {
  return {
    // So' conta as tentativas que FALHAM: entrar corretamente nao gasta o limite.
    loginPorIp: criarLimiter({
      limit: ipLimite, mensagem: MSG_TENTATIVAS, skipSuccessfulRequests: true, respeitarLimiteEmTeste: testar,
      keyGenerator: (req) => chave("login-ip", clientIp(req), emailDoCorpo(req)),
    }),
    // Teto por e-mail, qualquer que seja o IP: barra ataque distribuido.
    loginPorEmail: criarLimiter({
      limit: emailLimite, mensagem: MSG_TENTATIVAS, skipSuccessfulRequests: true, respeitarLimiteEmTeste: testar,
      keyGenerator: (req) => chave("login-email", emailDoCorpo(req)),
    }),
    cadastro: criarLimiter({
      limit: cadastroLimite, mensagem: "Muitos cadastros deste endereço. Tente novamente mais tarde.", respeitarLimiteEmTeste: testar,
      keyGenerator: (req) => chave("cadastro", clientIp(req)),
    }),
    // Tentativas erradas de senha ao excluir a conta (o token sozinho nao basta para adivinhar a senha).
    exclusao: criarLimiter({
      limit: exclusaoLimite, mensagem: MSG_TENTATIVAS, skipSuccessfulRequests: true, respeitarLimiteEmTeste: testar,
      keyGenerator: (req) => chave("exclusao", req.usuarioId),
    }),
  };
}

// Teto geral por IP em toda a API (health fica de fora).
const limiteGeral = criarLimiter({ limit: 1000 });

module.exports = { criarLimiter, criarLimitadoresAuth, limiteGeral };
