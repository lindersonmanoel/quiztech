# Imagem de producao da API do QUIZ TECH (Node.js).
# Contexto de build: a raiz do repositorio (precisa enxergar backend-node/, database/ e frontend/ juntos:
# as migracoes e o seed ficam em database/, e o site so' e' servido se SERVE_FRONTEND=1).
FROM node:26-alpine

WORKDIR /app

COPY --chown=node:node backend-node/package.json backend-node/package-lock.json ./backend-node/
RUN cd backend-node && npm ci --omit=dev

COPY --chown=node:node backend-node ./backend-node
COPY --chown=node:node database ./database
COPY --chown=node:node frontend ./frontend

WORKDIR /app/backend-node
ENV NODE_ENV=production
# Commit do build (aparece em /api/version e no rodape do site): docker compose le GIT_COMMIT do ambiente.
# Railway informa o commit em RAILWAY_GIT_COMMIT_SHA (build arg); o Docker Compose usa GIT_COMMIT.
ARG GIT_COMMIT=dev
ARG RAILWAY_GIT_COMMIT_SHA
ENV GIT_COMMIT=${RAILWAY_GIT_COMMIT_SHA:-$GIT_COMMIT}
EXPOSE 3100
USER node

# Saudavel = processo de pe E banco respondendo (/api/health/ready). Alpine ja traz o wget (busybox).
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-3100}/api/health/ready >/dev/null || exit 1

# Aplica migracoes e a carga inicial a cada deploy (idempotentes) e sobe a API. ";" e nao "&&" de proposito: se algo
# falhar, a API anterior continua de pe e o erro fica no log.
CMD ["sh", "-c", "node src/database/migrate.js || echo '[migrate] ATENCAO: falha ao aplicar migracoes - veja o erro acima'; node src/database/seed.js || echo '[seed] ATENCAO: falha na carga inicial - veja o erro acima'; exec node src/server.js"]
