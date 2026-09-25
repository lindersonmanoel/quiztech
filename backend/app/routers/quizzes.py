import math
import random
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from .. import config
from ..database import get_db
from ..deps import get_current_user, get_optional_user
from ..models import Category, Certificate, Question, Quiz, Result, User
from ..schemas import (
    CategoryOut,
    QuestionPublic,
    QuizDetail,
    QuizSummary,
    ResultOut,
    SubmitIn,
)
from .results import certificate_out, public_review

router = APIRouter(prefix="/api", tags=["quizzes"])


def _summary(quiz: Quiz) -> dict:
    return {
        "id": quiz.id,
        "title": quiz.title,
        "description": quiz.description,
        "category_id": quiz.category_id,
        "category_name": quiz.category.name,
        "difficulty": quiz.difficulty,
        "time_limit": quiz.time_limit,
        "question_count": len(quiz.questions),
        "total_points": sum(q.points for q in quiz.questions),
    }


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    counts = dict(
        db.execute(
            select(Quiz.category_id, func.count(Quiz.id)).where(Quiz.is_active.is_(True)).group_by(Quiz.category_id)
        ).all()
    )
    categories = db.scalars(select(Category).order_by(Category.group, Category.name)).all()
    return [CategoryOut(**{**c.__dict__, "quiz_count": counts.get(c.id, 0)}) for c in categories]


@router.get("/quizzes", response_model=list[QuizSummary])
def list_quizzes(
    category_id: int | None = None,
    q: str | None = Query(default=None, max_length=80),
    db: Session = Depends(get_db),
):
    stmt = (
        select(Quiz)
        .where(Quiz.is_active.is_(True))
        .options(selectinload(Quiz.category), selectinload(Quiz.questions))
        .order_by(Quiz.id)
    )
    if category_id is not None:
        stmt = stmt.where(Quiz.category_id == category_id)
    if q:
        stmt = stmt.where(Quiz.title.ilike(f"%{q}%"))
    return [_summary(quiz) for quiz in db.scalars(stmt).all()]


def _load_quiz(db: Session, quiz_id: int) -> Quiz:
    quiz = db.scalar(
        select(Quiz)
        .where(Quiz.id == quiz_id, Quiz.is_active.is_(True))
        .options(selectinload(Quiz.category), selectinload(Quiz.questions).selectinload(Question.alternatives))
    )
    if quiz is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Quiz não encontrado")
    return quiz


@router.get("/quizzes/{quiz_id}", response_model=QuizDetail)
def get_quiz(quiz_id: int, user: User | None = Depends(get_optional_user), db: Session = Depends(get_db)):
    """Devolve o quiz SEM indicar a alternativa correta; a ordem das alternativas é embaralhada."""
    quiz = _load_quiz(db, quiz_id)
    if user is not None:
        _enforce_retake_cooldown(db, user, quiz)  # avisa antes de o usuário gastar o tempo respondendo
    questions = []
    for question in quiz.questions:
        alternatives = [{"id": a.id, "text": a.text} for a in question.alternatives]
        random.shuffle(alternatives)
        questions.append(
            QuestionPublic(id=question.id, text=question.text, points=question.points, alternatives=alternatives)
        )
    return QuizDetail(**_summary(quiz), questions=questions)


def _new_certificate_code(db: Session) -> str:
    while True:
        code = "QT-" + secrets.token_hex(4).upper() + "-" + secrets.token_hex(2).upper()
        if not db.scalar(select(Certificate.id).where(Certificate.code == code)):
            return code


def _enforce_retake_cooldown(db: Session, user: User, quiz: Quiz) -> None:
    """Depois de reprovar, é preciso esperar antes de refazer (a menos que o usuário já tenha o certificado)."""
    if db.scalar(select(Certificate.id).where(Certificate.user_id == user.id, Certificate.quiz_id == quiz.id)):
        return
    last = db.scalar(
        select(Result).where(Result.user_id == user.id, Result.quiz_id == quiz.id).order_by(Result.created_at.desc()).limit(1)
    )
    if last is None:
        return
    taken_at = last.created_at if last.created_at.tzinfo else last.created_at.replace(tzinfo=timezone.utc)
    remaining = taken_at + timedelta(seconds=config.RETAKE_COOLDOWN_SECONDS) - datetime.now(timezone.utc)
    if remaining.total_seconds() > 0:
        minutes = math.ceil(remaining.total_seconds() / 60)
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Aguarde {minutes} min para refazer este quiz. Aproveite para revisar o conteúdo.",
            headers={"Retry-After": str(math.ceil(remaining.total_seconds()))},
        )


@router.post("/quizzes/{quiz_id}/submit", response_model=ResultOut, status_code=status.HTTP_201_CREATED)
def submit_quiz(
    quiz_id: int,
    data: SubmitIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Corrige no servidor: o cliente nunca recebe o gabarito antes de responder."""
    quiz = _load_quiz(db, quiz_id)
    _enforce_retake_cooldown(db, user, quiz)
    chosen = {a.question_id: a.alternative_id for a in data.answers}

    review, score, max_score, correct_count = [], 0, 0, 0
    for question in quiz.questions:
        by_id = {alt.id: alt for alt in question.alternatives}
        right = next(alt for alt in question.alternatives if alt.is_correct)
        picked = by_id.get(chosen.get(question.id))  # id inexistente ou de outra questão = sem resposta
        is_correct = picked is not None and picked.is_correct
        max_score += question.points
        if is_correct:
            score += question.points
            correct_count += 1
        review.append(
            {
                "question_id": question.id,
                "question": question.text,
                "points": question.points,
                "chosen_id": picked.id if picked else None,
                "chosen_text": picked.text if picked else None,
                "correct_id": right.id,
                "correct_text": right.text,
                "is_correct": is_correct,
            }
        )

    total = len(quiz.questions)
    percentage = round(correct_count / total * 100, 1) if total else 0.0
    time_spent = min(data.time_spent, quiz.time_limit) if quiz.time_limit else data.time_spent

    result = Result(
        user_id=user.id,
        quiz_id=quiz.id,
        score=score,
        max_score=max_score,
        correct_answers=correct_count,
        wrong_answers=total - correct_count,
        percentage=percentage,
        time_spent=time_spent,
        review=review,
    )
    db.add(result)
    db.flush()

    passed = percentage >= config.PASS_PERCENTAGE
    certificate = db.scalar(select(Certificate).where(Certificate.user_id == user.id, Certificate.quiz_id == quiz.id))
    if passed and certificate is None:
        certificate = Certificate(
            code=_new_certificate_code(db),
            user_id=user.id,
            quiz_id=quiz.id,
            result_id=result.id,
            score=score,
            percentage=percentage,
        )
        db.add(certificate)
    db.commit()
    db.refresh(result)

    return ResultOut(
        id=result.id,
        quiz_id=quiz.id,
        quiz_title=quiz.title,
        score=score,
        max_score=max_score,
        correct_answers=correct_count,
        wrong_answers=total - correct_count,
        percentage=percentage,
        time_spent=time_spent,
        passed=passed,
        created_at=result.created_at,
        review=public_review(review, passed),
        certificate=certificate_out(certificate) if certificate else None,
    )
