from app.seed_data import ALL_AREAS

from .conftest import register


def _quiz_id(client, category_slug):
    cats = {c["slug"]: c for c in client.get("/api/categories").json()}
    quizzes = client.get("/api/quizzes", params={"category_id": cats[category_slug]["id"]}).json()
    return quizzes[0]["id"]


def _correct_answers(db_session, quiz_id):
    from app.models import Quiz

    with db_session() as session:
        quiz = session.get(Quiz, quiz_id)
        return {q.id: next(a.id for a in q.alternatives if a.is_correct) for q in quiz.questions}


def test_seed_covers_all_areas_with_valid_questions(client):
    cats = client.get("/api/categories").json()
    assert len(cats) == len(ALL_AREAS) >= 30
    assert all(c["quiz_count"] == 1 for c in cats)
    assert len({c["slug"] for c in cats}) == len(cats)
    for area in ALL_AREAS:
        assert len(area["questions"]) == 6, area["name"]
        for text, correct, wrong in area["questions"]:
            options = [correct, *wrong]
            assert len(options) == 4 and len(set(options)) == 4, (area["name"], text)


def test_quiz_detail_never_leaks_answer_key(client):
    quiz = client.get(f"/api/quizzes/{_quiz_id(client, 'python')}").json()
    assert len(quiz["questions"]) == 6
    for q in quiz["questions"]:
        assert set(q) == {"id", "text", "points", "alternatives"}
        assert all(set(a) == {"id", "text"} for a in q["alternatives"])


def test_register_login_and_duplicate_email(client):
    register(client)
    dup = client.post("/api/auth/register", json={"name": "Ana", "email": "ANA@example.com", "password": "senha-forte-1"})
    assert dup.status_code == 409
    ok = client.post("/api/auth/login", json={"email": "ana@example.com", "password": "senha-forte-1"})
    assert ok.status_code == 200 and ok.json()["user"]["is_admin"] is False
    bad = client.post("/api/auth/login", json={"email": "ana@example.com", "password": "errada-123"})
    assert bad.status_code == 401


def test_login_is_rate_limited(client):
    register(client)
    for _ in range(5):
        client.post("/api/auth/login", json={"email": "ana@example.com", "password": "errada-123"})
    r = client.post("/api/auth/login", json={"email": "ana@example.com", "password": "senha-forte-1"})
    assert r.status_code == 429


def test_password_rules(client):
    short = client.post("/api/auth/register", json={"name": "Ana", "email": "a@b.co", "password": "curta"})
    assert short.status_code == 422
    long = client.post("/api/auth/register", json={"name": "Ana", "email": "a@b.co", "password": "é" * 40})
    assert long.status_code == 422


def test_submit_requires_login(client):
    r = client.post(f"/api/quizzes/{_quiz_id(client, 'python')}/submit", json={"answers": []})
    assert r.status_code == 401


def test_perfect_score_issues_certificate_once(client, db_session):
    headers = register(client)
    quiz_id = _quiz_id(client, "python")
    answers = [{"question_id": q, "alternative_id": a} for q, a in _correct_answers(db_session, quiz_id).items()]

    r = client.post(f"/api/quizzes/{quiz_id}/submit", json={"answers": answers, "time_spent": 42}, headers=headers)
    assert r.status_code == 201
    body = r.json()
    assert body["score"] == body["max_score"] == 120
    assert body["percentage"] == 100 and body["passed"] is True
    cert = body["certificate"]
    assert cert["code"].startswith("QT-") and cert["user_name"] == "Ana Souza"

    again = client.post(f"/api/quizzes/{quiz_id}/submit", json={"answers": answers}, headers=headers).json()
    assert again["certificate"]["code"] == cert["code"]  # não emite duplicado

    public = client.get(f"/api/certificates/{cert['code'].lower()}")
    assert public.status_code == 200
    assert "email" not in public.text
    assert client.get("/api/certificates/QT-NAOEXISTE").status_code == 404
    assert len(client.get("/api/certificates", headers=headers).json()) == 1


def test_failing_score_gives_no_certificate(client, db_session):
    headers = register(client)
    quiz_id = _quiz_id(client, "python")
    key = _correct_answers(db_session, quiz_id)
    q_ids = list(key)
    # acerta 3 de 6 (50%) e ignora o resto
    answers = [{"question_id": q, "alternative_id": key[q]} for q in q_ids[:3]]
    body = client.post(f"/api/quizzes/{quiz_id}/submit", json={"answers": answers}, headers=headers).json()
    assert body["percentage"] == 50 and body["passed"] is False and body["certificate"] is None
    assert body["correct_answers"] == 3 and body["wrong_answers"] == 3


def test_forged_alternative_from_other_question_counts_as_wrong(client, db_session):
    headers = register(client)
    quiz_id = _quiz_id(client, "python")
    key = _correct_answers(db_session, quiz_id)
    q_ids = list(key)
    # usa a alternativa correta da questão 2 para responder a questão 1
    answers = [{"question_id": q_ids[0], "alternative_id": key[q_ids[1]]}]
    body = client.post(f"/api/quizzes/{quiz_id}/submit", json={"answers": answers}, headers=headers).json()
    assert body["correct_answers"] == 0


def test_ranking_counts_best_score_per_quiz(client, db_session):
    headers = register(client)
    quiz_id = _quiz_id(client, "python")
    key = _correct_answers(db_session, quiz_id)
    full = [{"question_id": q, "alternative_id": a} for q, a in key.items()]
    client.post(f"/api/quizzes/{quiz_id}/submit", json={"answers": full}, headers=headers)
    client.post(f"/api/quizzes/{quiz_id}/submit", json={"answers": full}, headers=headers)
    ranking = client.get("/api/ranking").json()
    assert ranking == [{"position": 1, "user_name": "Ana Souza", "total_score": 120, "quizzes_completed": 1}]


def test_admin_routes_are_protected_and_admin_email_gets_role(client):
    user = register(client)
    assert client.get("/api/admin/stats").status_code == 401
    assert client.get("/api/admin/stats", headers=user).status_code == 403
    admin = register(client, email="admin@example.com", name="Admin")
    stats = client.get("/api/admin/stats", headers=admin)
    assert stats.status_code == 200 and stats.json()["categories"] >= 30


def test_admin_can_create_question_with_single_correct_answer(client):
    admin = register(client, email="admin@example.com", name="Admin")
    quiz_id = _quiz_id(client, "python")
    bad = client.post("/api/admin/questions", headers=admin, json={
        "quiz_id": quiz_id, "text": "Pergunta inválida?", "points": 10,
        "alternatives": [{"text": "A", "is_correct": True}, {"text": "B", "is_correct": True}],
    })
    assert bad.status_code == 422
    ok = client.post("/api/admin/questions", headers=admin, json={
        "quiz_id": quiz_id, "text": "Pergunta válida?", "points": 10,
        "alternatives": [{"text": "A", "is_correct": True}, {"text": "B"}],
    })
    assert ok.status_code == 201
    assert len(client.get(f"/api/quizzes/{quiz_id}").json()["questions"]) == 7
