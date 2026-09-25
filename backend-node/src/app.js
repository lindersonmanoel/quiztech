"use strict";

const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const config = require("./config");
const pool = require("./database/pool");
const errorHandler = require("./middleware/errorHandler");
const { limiteGeral, criarLimitadoresAuth } = require("./middleware/limiters");
const criarRotas = require("./routes");
const { buildInfo } = require("./version");

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);
const FRONTEND_DIR = path.join(__dirname, "..", "..", "frontend");

// Em producao, so' o FRONTEND_URL configurado passa (CORS estrito). Fora de producao, localhost e 127.0.0.1 sao
// equivalentes (para o navegador sao origens diferentes mesmo apontando para a mesma maquina).
// A propria origem da API sempre passa: scripts em modulo e fontes do site (quando a API serve o site,
// SERVE_FRONTEND=1) sao requisicoes CORS da mesma origem. Um site de terceiros nunca tem o nosso Host.
function corsOrigin(origin, req, callback) {
  if (!origin) return callback(null, true); // sem Origin: curl, apps, etc.
  if (config.frontendUrls.includes(origin)) return callback(null, true);
  try {
    if (new URL(origin).host === req.headers.host) return callback(null, true);
    if (!config.isProduction && LOCAL_HOSTNAMES.has(new URL(origin).hostname)) return callback(null, true);
  } catch (e) {
    /* Origin invalido: cai no bloqueio abaixo */
  }
  return callback(new Error("Origem não permitida pelo CORS."));
}

function createApp({ limitadores } = {}) {
  const app = express();

  // Atras de proxy (Cloudflare Tunnel etc.): "1" confia so' no primeiro salto (o proxy imediatamente na frente).
  // O IP real do visitante vem de CLIENT_IP_HEADER quando configurado (ver utils/ip.js).
  if (config.isProduction) app.set("trust proxy", 1);

  app.disable("x-powered-by");
  app.use(
    helmet({
      // A API responde a outra origem (o site no Vercel): o CORS decide quem pode ler, nao a CORP.
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          workerSrc: ["'self'"],
          manifestSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          ...(config.isProduction ? { upgradeInsecureRequests: [] } : {}),
        },
      },
    })
  );
  app.use(compression());
  app.use((req, res, next) =>
    cors({
      origin: (origin, callback) => corsOrigin(origin, req, callback),
      methods: ["GET", "POST", "PUT", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
      exposedHeaders: ["Retry-After"],
    })(req, res, next)
  );
  app.use(express.json({ limit: "100kb" }));
  if (!config.isTest) app.use(morgan(config.isProduction ? "combined" : "dev"));

  // Liveness: o processo esta de pe (nao consulta o banco).
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", ambiente: config.nodeEnv });
  });

  // Readiness: alem do processo, o banco responde (usado pelo healthcheck do Docker).
  app.get("/api/health/ready", async (_req, res) => {
    try {
      await Promise.race([
        pool.query("SELECT 1"),
        new Promise((_, rejeita) => setTimeout(() => rejeita(new Error("timeout")), 3000).unref()),
      ]);
      res.json({ status: "ok", banco: "ok" });
    } catch (err) {
      res.status(503).json({ status: "indisponivel", banco: "falha" });
    }
  });

  // Versao e commit em execucao (o frontend mostra no rodape e avisa quando sai uma versao nova).
  app.get("/api/version", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(buildInfo());
  });

  // Teto geral por IP em toda a API (health e version ficam de fora, definidos acima).
  app.use("/api", limiteGeral);
  app.use("/api", criarRotas(limitadores || criarLimitadoresAuth()));
  app.use("/api", (_req, res) => {
    res.status(404).json({ erro: "Rota não encontrada." });
  });

  // Opcional (demonstracao/local): serve tambem o site. Em producao o site fica no Vercel.
  if (config.serveFrontend) {
    app.use(
      express.static(FRONTEND_DIR, {
        setHeaders(res, filePath) {
          if (filePath.endsWith(".webmanifest")) res.type("application/manifest+json");
          if (filePath.endsWith("service-worker.js")) res.set("Cache-Control", "no-cache");
        },
      })
    );
  }

  app.use((_req, res) => {
    res.status(404).json({ erro: "Rota não encontrada." });
  });
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
