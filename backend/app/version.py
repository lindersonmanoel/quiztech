"""Versão do sistema. Ao publicar uma versão nova, altere __version__ e o CHANGELOG.md (versionamento semântico)."""
import os

__version__ = "1.1.0"


def build_info() -> dict:
    """Identifica o que está rodando: versão + commit + ambiente (o Vercel, o Docker e o CI preenchem o commit)."""
    commit = (
        os.getenv("VERCEL_GIT_COMMIT_SHA")
        or os.getenv("GIT_COMMIT")
        or os.getenv("COMMIT_SHA")
        or "dev"
    )
    environment = os.getenv("VERCEL_ENV") or os.getenv("ENVIRONMENT") or "development"
    return {
        "name": "QUIZ TECH",
        "version": __version__,
        "commit": commit[:7],
        "environment": environment,
    }
