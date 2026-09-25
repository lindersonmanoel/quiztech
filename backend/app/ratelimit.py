import hashlib
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from .models import LoginFailure

# Dois tetos independentes: por IP + e-mail (barra um atacante único) e por e-mail (barra ataque distribuído).
MAX_ATTEMPTS_PER_IP = 5
MAX_ATTEMPTS_PER_EMAIL = 20
WINDOW = timedelta(minutes=15)


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def ip_key(client_ip: str, email: str) -> str:
    return _hash(f"ip|{client_ip}|{email}")


def email_key(email: str) -> str:
    return _hash(f"email|{email}")


def _cutoff() -> datetime:
    return datetime.now(timezone.utc) - WINDOW


def _recent(db: Session, key: str) -> int:
    return db.scalar(
        select(func.count(LoginFailure.id)).where(LoginFailure.key == key, LoginFailure.created_at > _cutoff())
    ) or 0


def is_blocked(db: Session, ip: str, email: str) -> bool:
    return _recent(db, ip) >= MAX_ATTEMPTS_PER_IP or _recent(db, email) >= MAX_ATTEMPTS_PER_EMAIL


def register_failure(db: Session, ip: str, email: str) -> None:
    db.execute(delete(LoginFailure).where(LoginFailure.created_at < _cutoff()))  # limpeza oportunista
    db.add_all([LoginFailure(key=ip), LoginFailure(key=email)])
    db.commit()


MAX_REGISTRATIONS_PER_IP = 10


def registration_key(client_ip: str) -> str:
    return _hash(f"register|{client_ip}")


def registration_blocked(db: Session, key: str) -> bool:
    return _recent(db, key) >= MAX_REGISTRATIONS_PER_IP


def record_registration_attempt(db: Session, key: str) -> None:
    db.add(LoginFailure(key=key))
    db.commit()


def reset(db: Session, ip: str) -> None:
    """Login bem-sucedido zera só o contador do IP; o do e-mail expira sozinho (não dá para 'lavar' um ataque)."""
    db.execute(delete(LoginFailure).where(LoginFailure.key == ip))
    db.commit()
