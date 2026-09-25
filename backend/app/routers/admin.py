from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_admin
from ..models import Alternative, Category, Certificate, Question, Quiz, Result, User
from ..schemas import CategoryIn, CategoryOut, QuestionIn, QuizIn, QuizSummary

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


def _get_or_404(db: Session, model, obj_id: int, label: str):
    obj = db.get(model, obj_id)
    if obj is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"{label} não encontrado(a)")
    return obj


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    count = lambda model: db.scalar(select(func.count()).select_from(model))  # noqa: E731
    return {
        "users": count(User),
        "categories": count(Category),
        "quizzes": count(Quiz),
        "questions": count(Question),
        "results": count(Result),
        "certificates": count(Certificate),
    }


# ---------- Categorias ----------
@router.post("/categories", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(data: CategoryIn, db: Session = Depends(get_db)):
    category = Category(**data.model_dump())
    db.add(category)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Nome ou slug já existe")
    return CategoryOut(**{**category.__dict__, "quiz_count": 0})


@router.put("/categories/{category_id}", response_model=CategoryOut)
def update_category(category_id: int, data: CategoryIn, db: Session = Depends(get_db)):
    category = _get_or_404(db, Category, category_id, "Categoria")
    for key, value in data.model_dump().items():
        setattr(category, key, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Nome ou slug já existe")
    return CategoryOut(**{**category.__dict__, "quiz_count": len(category.quizzes)})


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    category = _get_or_404(db, Category, category_id, "Categoria")
    if db.scalar(select(func.count()).select_from(Result).join(Quiz).where(Quiz.category_id == category_id)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Há resultados nesta categoria; desative os quizzes em vez de excluir")
    db.delete(category)
    db.commit()


# ---------- Quizzes ----------
@router.post("/quizzes", response_model=QuizSummary, status_code=status.HTTP_201_CREATED)
def create_quiz(data: QuizIn, db: Session = Depends(get_db)):
    category = _get_or_404(db, Category, data.category_id, "Categoria")
    quiz = Quiz(**data.model_dump())
    db.add(quiz)
    db.commit()
    return QuizSummary(
        id=quiz.id, title=quiz.title, description=quiz.description, category_id=category.id,
        category_name=category.name, difficulty=quiz.difficulty, time_limit=quiz.time_limit,
        question_count=0, total_points=0,
    )


@router.put("/quizzes/{quiz_id}", response_model=QuizSummary)
def update_quiz(quiz_id: int, data: QuizIn, db: Session = Depends(get_db)):
    quiz = _get_or_404(db, Quiz, quiz_id, "Quiz")
    category = _get_or_404(db, Category, data.category_id, "Categoria")
    for key, value in data.model_dump().items():
        setattr(quiz, key, value)
    db.commit()
    return QuizSummary(
        id=quiz.id, title=quiz.title, description=quiz.description, category_id=category.id,
        category_name=category.name, difficulty=quiz.difficulty, time_limit=quiz.time_limit,
        question_count=len(quiz.questions), total_points=sum(q.points for q in quiz.questions),
    )


@router.delete("/quizzes/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quiz(quiz_id: int, db: Session = Depends(get_db)):
    quiz = _get_or_404(db, Quiz, quiz_id, "Quiz")
    if db.scalar(select(func.count()).select_from(Result).where(Result.quiz_id == quiz_id)):
        # Há histórico e certificados apontando para ele: apenas desativa.
        quiz.is_active = False
    else:
        db.delete(quiz)
    db.commit()


# ---------- Perguntas ----------
@router.post("/questions", status_code=status.HTTP_201_CREATED)
def create_question(data: QuestionIn, db: Session = Depends(get_db)):
    quiz = _get_or_404(db, Quiz, data.quiz_id, "Quiz")
    question = Question(
        quiz_id=quiz.id,
        text=data.text,
        points=data.points,
        position=len(quiz.questions),
        alternatives=[Alternative(text=a.text, is_correct=a.is_correct) for a in data.alternatives],
    )
    db.add(question)
    db.commit()
    return {"id": question.id}


@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question(question_id: int, db: Session = Depends(get_db)):
    question = _get_or_404(db, Question, question_id, "Pergunta")
    db.delete(question)
    db.commit()
