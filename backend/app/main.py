import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from . import config
from .database import Base, SessionLocal, engine
from .routers import admin, auth, quizzes, results
from .seed import seed_if_empty

log = logging.getLogger("quiztech")


def bootstrap() -> None:
    """Cria as tabelas e carrega as áreas que faltam (idempotente)."""
    Base.metadata.create_all(engine)
    if config.SEED_ON_STARTUP:
        with SessionLocal() as db:
            seed_if_empty(db)


@asynccontextmanager
async def lifespan(_: FastAPI):
    bootstrap()
    yield


app = FastAPI(
    title="QUIZ TECH API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if config.DOCS_ENABLED else None,
    redoc_url=None,
    openapi_url="/openapi.json" if config.DOCS_ENABLED else None,
)

if config.IS_SERVERLESS:
    # Funções serverless não garantem o evento de lifespan: prepara o banco na partida a frio.
    try:
        bootstrap()
    except Exception:  # noqa: BLE001 - a API sobe e o erro aparece nos logs da função
        log.exception("Falha ao preparar o banco de dados na inicialização")

if config.CORS_ORIGINS:  # em produção o frontend é servido pela própria API (mesma origem)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.CORS_ORIGINS,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )


# Mesma política aplicada aos arquivos estáticos pelo vercel.json.
CSP = (
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
    "connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
)


# O Swagger (só fora de produção) carrega scripts e estilos do jsDelivr e usa um script inline.
DOCS_CSP = (
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https://fastapi.tiangolo.com; "
    "frame-ancestors 'none'"
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Content-Security-Policy", DOCS_CSP if request.url.path == "/docs" else CSP)
    return response


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    log.exception("Erro não tratado em %s %s", request.method, request.url.path)
    return JSONResponse({"detail": "Erro interno do servidor"}, status_code=500)


@app.get("/api/health", tags=["infra"])
def health():
    return {"status": "ok"}


for module in (auth, quizzes, results, admin):
    app.include_router(module.router)

if config.FRONTEND_DIR.is_dir():
    app.mount("/", StaticFiles(directory=config.FRONTEND_DIR, html=True), name="frontend")
