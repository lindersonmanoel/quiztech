"use strict";

require("dotenv").config();

const REQUIRED_IN_PRODUCTION = ["DATABASE_URL", "JWT_SECRET", "FRONTEND_URL"];

function boolFromEnv(value, fallback) {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on", "sim"].includes(String(value).trim().toLowerCase());
}

function buildConfig() {
  const nodeEnv = process.env.NODE_ENV || "development";
  const isProduction = nodeEnv === "production";

  if (isProduction) {
    const missing = REQUIRED_IN_PRODUCTION.filter((name) => !process.env[name]);
    if (missing.length) {
      throw new Error(
        `Faltam variáveis de ambiente obrigatórias em produção: ${missing.join(", ")}. Preencha o .env.production.`
      );
    }
  }

  const jwtSecret = process.env.JWT_SECRET || (isProduction ? "" : "chave-apenas-para-desenvolvimento-local");
  if (!isProduction && !process.env.JWT_SECRET && nodeEnv !== "test") {
    // eslint-disable-next-line no-console
    console.warn(
      "[config] JWT_SECRET não definido: usando uma chave fixa de desenvolvimento. Defina JWT_SECRET antes de ir para produção."
    );
  }

  // FRONTEND_URL aceita varias origens separadas por virgula (ex.: dominio novo + endereco antigo).
  const frontendUrls = (process.env.FRONTEND_URL || "http://localhost:5500")
    .split(",").map((u) => u.trim().replace(/\/+$/, "")).filter(Boolean);
  const smtpPort = Number(process.env.SMTP_PORT) || 587;
  const smtpUser = String(process.env.SMTP_USER || "").trim();

  return {
    nodeEnv,
    isProduction,
    isTest: nodeEnv === "test",
    port: Number(process.env.PORT) || 3100, // 3100: nao conflita com o Meu Bolso Digital (3000) na mesma maquina
    databaseUrl: process.env.DATABASE_URL || "",
    databaseSsl: boolFromEnv(process.env.DATABASE_SSL, false),
    databaseSslCa: process.env.DATABASE_SSL_CA ? process.env.DATABASE_SSL_CA.replace(/\\n/g, "\n") : "",
    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",
    frontendUrls,
    // Endereco publico do SITE, usado nos links dos e-mails (redefinir senha) e no QR Code do certificado.
    appUrl: String(process.env.APP_URL || frontendUrls[0]).trim().replace(/\/+$/, ""),
    // Envio de e-mail (SMTP). Sem SMTP_HOST a recuperacao de senha nao consegue enviar o link.
    smtp: {
      host: String(process.env.SMTP_HOST || "").trim(),
      port: smtpPort,
      secure: boolFromEnv(process.env.SMTP_SECURE, smtpPort === 465),
      user: smtpUser,
      pass: String(process.env.SMTP_PASS || ""),
      from: String(process.env.SMTP_FROM || "").trim() || (smtpUser ? `QUIZ TECH <${smtpUser}>` : ""),
    },
    // Validade do link de redefinicao de senha.
    resetMinutos: Number(process.env.RESET_TOKEN_MINUTES) || 60,
    // Fuso que define o inicio da semana (segunda) e do mes no ranking semanal/mensal.
    rankingFuso: String(process.env.RANKING_TZ || "America/Sao_Paulo").trim(),
    // O usuario que se cadastrar com este e-mail vira administrador.
    adminEmail: String(process.env.ADMIN_EMAIL || "").trim().toLowerCase(),
    // Aproveitamento minimo (%) para aprovacao e emissao do certificado.
    aprovacaoPercentual: 70,
    // Intervalo minimo para refazer um quiz reprovado (0 desliga).
    refazerEsperaSegundos: process.env.RETAKE_COOLDOWN_SECONDS === undefined || process.env.RETAKE_COOLDOWN_SECONDS === ""
      ? 600
      : Number(process.env.RETAKE_COOLDOWN_SECONDS),
    // Cabecalho, escrito por um proxy CONFIAVEL, com o IP real do visitante (ex.: cf-connecting-ip no Cloudflare).
    // So' defina se todo o trafego passar por esse proxy; senao o cliente poderia forja-lo.
    clientIpHeader: String(process.env.CLIENT_IP_HEADER || "").trim().toLowerCase(),
    // Onde ficam os contadores do limite de tentativas: "memory" (uma instancia, padrao) ou "postgres" (varias
    // instancias, ex.: Vercel). No Vercel (variavel VERCEL) o padrao e' postgres.
    rateLimitStore: String(process.env.RATE_LIMIT_STORE || (process.env.VERCEL ? "postgres" : "memory")).trim().toLowerCase(),
    // Serve tambem o frontend (pasta ../frontend): util em demonstracao/local. Em producao o site fica no Vercel.
    serveFrontend: boolFromEnv(process.env.SERVE_FRONTEND, false),
  };
}

module.exports = buildConfig();
