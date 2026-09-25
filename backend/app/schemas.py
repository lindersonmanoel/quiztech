from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from .security import MAX_PASSWORD_BYTES

Difficulty = Literal["facil", "media", "dificil"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Usuários ----------
class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        v = " ".join(v.split())
        if len(v) < 2:
            raise ValueError("Nome muito curto")
        return v

    @field_validator("password")
    @classmethod
    def _password_size(cls, v: str) -> str:
        if len(v.encode("utf-8")) > MAX_PASSWORD_BYTES:
            raise ValueError("Senha muito longa (máximo de 72 bytes)")
        return v


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=80)


class UserOut(ORM):
    id: int
    name: str
    email: str
    is_admin: bool


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Categorias / quizzes ----------
class CategoryIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    slug: str = Field(min_length=2, max_length=80, pattern=r"^[a-z0-9-]+$")
    group: str = Field(min_length=2, max_length=60)
    icon: str = Field(default="", max_length=8)
    description: str = Field(default="", max_length=500)


class CategoryOut(ORM):
    id: int
    name: str
    slug: str
    group: str
    icon: str
    description: str
    quiz_count: int = 0


class QuizIn(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    description: str = Field(default="", max_length=500)
    category_id: int
    difficulty: Difficulty = "media"
    time_limit: int = Field(default=0, ge=0, le=7200)
    is_active: bool = True


class QuizSummary(ORM):
    id: int
    title: str
    description: str
    category_id: int
    category_name: str
    difficulty: Difficulty
    time_limit: int
    question_count: int
    total_points: int


class AlternativePublic(ORM):
    id: int
    text: str


class QuestionPublic(ORM):
    id: int
    text: str
    points: int
    alternatives: list[AlternativePublic]


class QuizDetail(QuizSummary):
    questions: list[QuestionPublic]


# ---------- Perguntas (admin) ----------
class AlternativeIn(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    is_correct: bool = False


class QuestionIn(BaseModel):
    quiz_id: int
    text: str = Field(min_length=3, max_length=1000)
    points: int = Field(default=10, ge=1, le=100)
    alternatives: list[AlternativeIn] = Field(min_length=2, max_length=6)

    @field_validator("alternatives")
    @classmethod
    def _one_correct(cls, v: list[AlternativeIn]) -> list[AlternativeIn]:
        if sum(1 for a in v if a.is_correct) != 1:
            raise ValueError("Informe exatamente uma alternativa correta")
        return v


# ---------- Respostas / resultados ----------
class AnswerIn(BaseModel):
    question_id: int
    alternative_id: int | None = None


class SubmitIn(BaseModel):
    answers: list[AnswerIn] = Field(max_length=200)
    time_spent: int = Field(default=0, ge=0, le=86400)


class ReviewItem(BaseModel):
    question_id: int
    question: str
    points: int
    chosen_id: int | None
    chosen_text: str | None
    correct_id: int
    correct_text: str
    is_correct: bool


class CertificateOut(BaseModel):
    code: str
    user_name: str
    quiz_id: int
    quiz_title: str
    category_name: str
    score: int
    percentage: float
    issued_at: datetime


class ResultOut(BaseModel):
    id: int
    quiz_id: int
    quiz_title: str
    score: int
    max_score: int
    correct_answers: int
    wrong_answers: int
    percentage: float
    time_spent: int
    passed: bool
    created_at: datetime
    review: list[ReviewItem] = []
    certificate: CertificateOut | None = None


class ResultSummary(BaseModel):
    id: int
    quiz_id: int
    quiz_title: str
    score: int
    max_score: int
    percentage: float
    passed: bool
    created_at: datetime


class RankingEntry(BaseModel):
    position: int
    user_name: str
    total_score: int
    quizzes_completed: int
