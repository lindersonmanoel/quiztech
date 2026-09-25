from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import NullPool

from . import config

_connect_args = {"check_same_thread": False} if config.DATABASE_URL.startswith("sqlite") else {}
_engine_options = {"connect_args": _connect_args, "pool_pre_ping": True}
if config.IS_SERVERLESS:
    # Cada invocação serverless abre e fecha sua conexão; o pool fica por conta do provedor (ex.: Neon/PgBouncer).
    _engine_options["poolclass"] = NullPool
engine = create_engine(config.DATABASE_URL, **_engine_options)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
