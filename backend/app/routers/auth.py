from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import config, ratelimit
from ..database import get_db
from ..deps import get_current_user
from ..models import Certificate, Result, User
from ..schemas import DeleteAccountIn, LoginIn, RegisterIn, TokenOut, UserOut, UserUpdate
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api", tags=["auth"])


def _client_ip(request: Request) -> str:
    # Só o Vercel sobrescreve este cabeçalho; em qualquer outro host o cliente poderia forjá-lo.
    if config.IS_SERVERLESS:
        forwarded = request.headers.get("x-vercel-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "?"


# Hash de uma senha qualquer: usado para gastar o mesmo tempo quando o e-mail não existe.
_DUMMY_HASH = hash_password("senha-inexistente")


@router.post("/auth/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(data: RegisterIn, request: Request, db: Session = Depends(get_db)):
    reg_key = ratelimit.registration_key(_client_ip(request))
    if ratelimit.registration_blocked(db, reg_key):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Muitos cadastros deste endereço. Tente novamente mais tarde.")
    ratelimit.record_registration_attempt(db, reg_key)
    email = data.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "E-mail já cadastrado")
    user = User(
        name=data.name,
        email=email,
        password_hash=hash_password(data.password),
        is_admin=bool(config.ADMIN_EMAIL) and email == config.ADMIN_EMAIL,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "E-mail já cadastrado")
    return TokenOut(access_token=create_access_token(user.id), user=UserOut.model_validate(user))


@router.post("/auth/login", response_model=TokenOut)
def login(data: LoginIn, request: Request, db: Session = Depends(get_db)):
    email = data.email.lower()
    ip = ratelimit.ip_key(_client_ip(request), email)
    by_email = ratelimit.email_key(email)
    if ratelimit.is_blocked(db, ip, by_email):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Muitas tentativas. Tente novamente em alguns minutos.")

    user = db.scalar(select(User).where(User.email == email))
    ok = verify_password(data.password, user.password_hash if user else _DUMMY_HASH)
    if not user or not ok:
        ratelimit.register_failure(db, ip, by_email)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "E-mail ou senha inválidos")
    ratelimit.reset(db, ip)
    return TokenOut(access_token=create_access_token(user.id), user=UserOut.model_validate(user))


@router.get("/users/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.put("/users/me", response_model=UserOut)
def update_me(data: UserUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.name = " ".join(data.name.split())
    db.commit()
    return user


@router.post("/users/me/delete", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(
    data: DeleteAccountIn,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Direito de exclusão (LGPD): apaga conta, resultados e certificados. Exige a senha."""
    ip = ratelimit.ip_key(_client_ip(request), user.email)
    by_email = ratelimit.email_key(user.email)
    if ratelimit.is_blocked(db, ip, by_email):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Muitas tentativas. Tente novamente em alguns minutos.")
    if not verify_password(data.password, user.password_hash):
        ratelimit.register_failure(db, ip, by_email)
        # 403 (e não 401) para o frontend não interpretar como sessão expirada
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Senha incorreta")
    db.execute(delete(Certificate).where(Certificate.user_id == user.id))
    db.execute(delete(Result).where(Result.user_id == user.id))
    db.delete(user)
    db.commit()
