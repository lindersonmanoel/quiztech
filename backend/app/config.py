import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

SECRET_KEY = os.getenv("SECRET_KEY", "")
if not SECRET_KEY:
    if ENVIRONMENT == "production":
        raise RuntimeError("SECRET_KEY é obrigatória em produção")
    SECRET_KEY = "dev-only-change-me-not-for-production-0123456789"

PASS_PERCENTAGE = 70  # aproveitamento mínimo para aprovação e emissão do certificado
ACCESS_TOKEN_MINUTES = int(os.getenv("ACCESS_TOKEN_MINUTES", "720"))
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "").strip().lower()
SEED_ON_STARTUP = os.getenv("SEED_ON_STARTUP", "1") == "1"
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]


def _database_url() -> str:
    url = os.getenv("DATABASE_URL", "sqlite:///./quiztech.db")
    # O Railway entrega postgres:// ou postgresql://; o SQLAlchemy precisa do driver.
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg2://" + url[len("postgresql://"):]
    return url


DATABASE_URL = _database_url()
FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"
