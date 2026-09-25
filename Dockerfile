FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend backend
COPY frontend frontend

RUN useradd --create-home appuser
USER appuser

WORKDIR /app/backend
ENV ENVIRONMENT=production

# Informe o commit no build (docker compose lê GIT_COMMIT do ambiente); aparece em /api/version.
ARG GIT_COMMIT=dev
ENV GIT_COMMIT=$GIT_COMMIT

EXPOSE 8000

# O Railway/Compose podem definir $PORT; sem ele usa 8000.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/api/health' % os.getenv('PORT', '8000'), timeout=4)" || exit 1

ENTRYPOINT ["sh", "/app/backend/docker-entrypoint.sh"]
