"""Carga inicial: uma categoria e um quiz por área de tecnologia (idempotente por slug)."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Alternative, Category, Question, Quiz
from .seed_data import ALL_AREAS, POINTS_BY_POSITION, QUIZ_TIME_LIMIT


def seed_if_empty(db: Session) -> int:
    """Cria as áreas que ainda não existem. Devolve quantas foram criadas."""
    existing = set(db.scalars(select(Category.slug)).all())
    created = 0
    for area in ALL_AREAS:
        if area["slug"] in existing:
            continue
        category = Category(
            name=area["name"], slug=area["slug"], group=area["group"],
            icon=area["icon"], description=area["description"],
        )
        quiz = Quiz(
            title=f"Quiz de {area['name']}",
            description=f"Teste seus conhecimentos em {area['name']}. {area['description']}",
            difficulty="media",
            time_limit=QUIZ_TIME_LIMIT,
            category=category,
        )
        for position, (text, correct, wrong) in enumerate(area["questions"]):
            quiz.questions.append(
                Question(
                    text=text,
                    points=POINTS_BY_POSITION[position],
                    position=position,
                    alternatives=[Alternative(text=correct, is_correct=True)]
                    + [Alternative(text=w) for w in wrong],
                )
            )
        db.add(category)
        created += 1
    db.commit()
    return created
