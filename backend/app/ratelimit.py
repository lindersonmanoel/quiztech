import hashlib
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from .models import LoginFailure

MAX_ATTEMPTS = 5
WINDOW = timedelta(minutes=15)


def make_key(client_ip: str, email: str) -> str:
    return hashlib.sha256(f"{client_ip}|{email}".encode("utf-8")).hexdigest()


def _cutoff() -> datetime:
    return datetime.now(timezone.utc) - WINDOW


def is_blocked(db: Session, key: str) -> bool:
    recent = db.scalar(
        select(func.count(LoginFailure.id)).where(LoginFailure.key == key, LoginFailure.created_at > _cutoff())
    )
    return (recent or 0) >= MAX_ATTEMPTS


def register_failure(db: Session, key: str) -> None:
    db.execute(delete(LoginFailure).where(LoginFailure.created_at < _cutoff()))  # limpeza oportunista
    db.add(LoginFailure(key=key))
    db.commit()


def reset(db: Session, key: str) -> None:
    db.execute(delete(LoginFailure).where(LoginFailure.key == key))
    db.commit()
