"use strict";

const { Router } = require("express");
const { requireAuth, optionalAuth, requireAdmin } = require("../middleware/auth.middleware");
const { criarLimitadoresAuth } = require("../middleware/limiters");
const auth = require("../controllers/auth.controller");
const quiz = require("../controllers/quiz.controller");
const resultado = require("../controllers/resultado.controller");
const admin = require("../controllers/admin.controller");
const emailService = require("../services/email.service");

/** Monta as rotas da API. `limitadores` e' injetavel para os testes baixarem os tetos. */
function criarRotas(limitadores = criarLimitadoresAuth()) {
  const router = Router();

  // Recursos que dependem da configuracao do servidor (o site esconde/avisa o que nao esta ativo).
  router.get("/config", (_req, res) => res.json({ password_reset: emailService.configurado() }));

  // ---- Conta ----
  router.post("/auth/register", limitadores.cadastro, auth.register);
  router.post("/auth/login", limitadores.loginPorIp, limitadores.loginPorEmail, auth.login);
  router.post("/auth/forgot-password", limitadores.esqueciPorIp, limitadores.esqueciPorEmail, auth.forgotPassword);
  router.post("/auth/reset-password", limitadores.redefinicao, auth.resetPassword);
  router.get("/users/me", requireAuth, auth.me);
  router.put("/users/me", requireAuth, auth.updateMe);
  router.post("/users/me/delete", requireAuth, limitadores.exclusao, auth.deleteMe);

  // ---- Quizzes ----
  router.get("/categories", quiz.categorias);
  router.get("/quizzes", quiz.listar);
  router.get("/quizzes/:id", optionalAuth, quiz.detalhe);
  router.post("/quizzes/:id/submit", requireAuth, quiz.submeter);

  // ---- Resultados, ranking e certificados ----
  router.get("/results", requireAuth, resultado.listar);
  router.get("/results/:id", requireAuth, resultado.detalhe);
  router.get("/ranking", resultado.ranking);
  router.get("/certificates", requireAuth, resultado.certificados);
  router.get("/certificates/:codigo", resultado.verificarCertificado);
  router.get("/certificates/:codigo/qr.svg", resultado.qrCertificado);

  // ---- Administracao ----
  const adm = Router();
  adm.use(requireAuth, requireAdmin);
  adm.get("/stats", admin.estatisticas);
  adm.get("/activity", admin.atividade);
  adm.post("/categories", admin.criarCategoria);
  adm.put("/categories/:id", admin.atualizarCategoria);
  adm.delete("/categories/:id", admin.excluirCategoria);
  adm.get("/quizzes", admin.listarQuizzes);
  adm.get("/quizzes/:id", admin.detalheQuiz);
  adm.post("/quizzes", admin.criarQuiz);
  adm.put("/quizzes/:id", admin.atualizarQuiz);
  adm.delete("/quizzes/:id", admin.excluirQuiz);
  adm.post("/questions", admin.criarPergunta);
  adm.put("/questions/:id", admin.atualizarPergunta);
  adm.delete("/questions/:id", admin.excluirPergunta);
  adm.get("/users", admin.listarUsuarios);
  adm.put("/users/:id/admin", admin.definirAdmin);
  router.use("/admin", adm);

  return router;
}

module.exports = criarRotas;
