#!/bin/sh
# Inicialização do contêiner: aplica as migrações e sobe a API.
set -e

echo "Aplicando migrações do banco de dados..."
python -m alembic upgrade head

echo "Iniciando a API na porta ${PORT:-8000}..."
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --proxy-headers \
    --forwarded-allow-ips="${FORWARDED_ALLOW_IPS:-127.0.0.1}"
