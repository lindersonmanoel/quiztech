import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

IS_SERVERLESS = bool(os.getenv("VERCEL"))  # o Vercel define esta variável nas funções
ENVIRONMENT = os.getenv("ENVIRONMENT") or ("production" if IS_SERVERLESS else "development")

SECRET_KEY = os.getenv("SECRET_KEY", "")
if not SECRET_KEY:
    if ENVIRONMENT == "production":
        raise RuntimeError("SECRET_KEY é obrigatória em produção")
    SECRET_KEY = "dev-only-change-me-not-for-production-0123456789"

PASS_PERCENTAGE = 70  # aproveitamento mínimo para aprovação e emissão do certificado
# Intervalo mínimo para refazer um quiz reprovado (impede tentar de novo em sequência com o que acabou de ver).
RETAKE_COOLDOWN_SECONDS = int(os.getenv("RETAKE_COOLDOWN_SECONDS", "600"))
# /docs e /openapi.json ficam desligados em produção (expõem a lista de rotas, inclusive as de admin).
DOCS_ENABLED = ENVIRONMENT != "production" or os.getenv("ENABLE_DOCS") == "1"
# Cabeçalho, escrito por um proxy confiável, que traz o IP real do visitante (ex.: cf-connecting-ip no Cloudflare).
# Só defina se TODO o tráfego passar por esse proxy; caso contrário o cliente poderia forjá-lo.
CLIENT_IP_HEADER = os.getenv("CLIENT_IP_HEADER", "").strip().lower()
ACCESS_TOKEN_MINUTES = int(os.getenv("ACCESS_TOKEN_MINUTES", "720"))
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "").strip().lower()
SEED_ON_STARTUP = os.getenv("SEED_ON_STARTUP", "1") == "1"
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]


def _database_url() -> str:
    url = os.getenv("DATABASE_URL", "")
    if not url:
        if ENVIRONMENT == "production":
            # SQLite em disco não persiste no Vercel/Railway: melhor falhar do que perder dados.
            raise RuntimeError("DATABASE_URL é obrigatória em produção (use um PostgreSQL)")
        url = "sqlite:///./quiztech.db"
    # O Railway entrega postgres:// ou postgresql://; o SQLAlchemy precisa do driver.
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg2://" + url[len("postgresql://"):]
    return url


DATABASE_URL = _database_url()
FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"
