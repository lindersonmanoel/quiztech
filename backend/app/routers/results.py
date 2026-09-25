from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from .. import config
from ..database import get_db
from ..deps import get_current_user
from ..models import Certificate, Quiz, Result, User
from ..schemas import CertificateOut, RankingEntry, ResultOut, ResultSummary

router = APIRouter(prefix="/api", tags=["results"])


def certificate_out(cert: Certificate) -> CertificateOut:
    return CertificateOut(
        code=cert.code,
        user_name=cert.user.name,
        quiz_id=cert.quiz_id,
        quiz_title=cert.quiz.title,
        category_name=cert.quiz.category.name,
        score=cert.score,
        percentage=cert.percentage,
        issued_at=cert.issued_at,
    )


def public_name(full_name: str) -> str:
    """Ranking é público: mostra só o primeiro nome e a inicial do último (o nome completo fica no certificado)."""
    parts = full_name.split()
    if len(parts) < 2:
        return parts[0] if parts else "Anônimo"
    return f"{parts[0]} {parts[-1][0].upper()}."


def public_review(review: list[dict], passed: bool) -> list[dict]:
    """Só quem foi aprovado vê o gabarito; os demais veem apenas quais respostas estavam certas."""
    if passed:
        return review
    return [{**item, "correct_id": None, "correct_text": None} for item in review]


def _cert_query():
    return select(Certificate).options(
        selectinload(Certificate.user), selectinload(Certificate.quiz).selectinload(Quiz.category)
    )


@router.get("/results", response_model=list[ResultSummary])
def my_results(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Result)
        .where(Result.user_id == user.id)
        .options(selectinload(Result.quiz))
        .order_by(Result.created_at.desc())
        .limit(100)
    ).all()
    return [
        ResultSummary(
            id=r.id,
            quiz_id=r.quiz_id,
            quiz_title=r.quiz.title,
            score=r.score,
            max_score=r.max_score,
            percentage=r.percentage,
            passed=r.percentage >= config.PASS_PERCENTAGE,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.get("/results/{result_id}", response_model=ResultOut)
def get_result(result_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    r = db.scalar(select(Result).where(Result.id == result_id, Result.user_id == user.id).options(selectinload(Result.quiz)))
    if r is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resultado não encontrado")
    cert = db.scalar(_cert_query().where(Certificate.result_id == r.id))
    return ResultOut(
        id=r.id,
        quiz_id=r.quiz_id,
        quiz_title=r.quiz.title,
        score=r.score,
        max_score=r.max_score,
        correct_answers=r.correct_answers,
        wrong_answers=r.wrong_answers,
        percentage=r.percentage,
        time_spent=r.time_spent,
        passed=r.percentage >= config.PASS_PERCENTAGE,
        created_at=r.created_at,
        review=public_review(r.review, r.percentage >= config.PASS_PERCENTAGE),
        certificate=certificate_out(cert) if cert else None,
    )


@router.get("/ranking", response_model=list[RankingEntry])
def ranking(
    category_id: int | None = None,
    quiz_id: int | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Soma a melhor pontuação de cada usuário em cada quiz (refazer não infla o ranking)."""
    best = select(Result.user_id, Result.quiz_id, func.max(Result.score).label("best")).group_by(
        Result.user_id, Result.quiz_id
    )
    if quiz_id is not None:
        best = best.where(Result.quiz_id == quiz_id)
    if category_id is not None:
        best = best.join(Quiz, Quiz.id == Result.quiz_id).where(Quiz.category_id == category_id)
    best = best.subquery()

    rows = db.execute(
        select(User.name, func.sum(best.c.best), func.count(best.c.quiz_id))
        .join(User, User.id == best.c.user_id)
        .group_by(User.id, User.name)
        .order_by(func.sum(best.c.best).desc(), User.name)
        .limit(limit)
    ).all()
    return [
        RankingEntry(position=i, user_name=public_name(name), total_score=int(total), quizzes_completed=int(done))
        for i, (name, total, done) in enumerate(rows, start=1)
    ]


@router.get("/certificates", response_model=list[CertificateOut])
def my_certificates(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    certs = db.scalars(_cert_query().where(Certificate.user_id == user.id).order_by(Certificate.issued_at.desc())).all()
    return [certificate_out(c) for c in certs]


@router.get("/certificates/{code}", response_model=CertificateOut)
def verify_certificate(code: str, db: Session = Depends(get_db)):
    """Consulta pública por código, para validar a autenticidade. Não expõe o e-mail."""
    cert = db.scalar(_cert_query().where(Certificate.code == code.strip().upper()))
    if cert is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Certificado não encontrado")
    return certificate_out(cert)
