import { api, DIFFICULTY, el, fmtTime, params, renderNav, requireLogin, showMessage, $ } from "./app.js";

renderNav();

const stage = $("#stage");
const quizId = Number(params().get("id"));
const chosen = new Map(); // id da pergunta -> id da alternativa
let quiz = null;
let current = 0;
let startedAt = 0;
let timerId = null;
let submitting = false;

const remaining = () =>
  quiz.time_limit ? Math.max(0, quiz.time_limit - Math.floor((Date.now() - startedAt) / 1000)) : null;

async function load() {
  if (!requireLogin()) return;
  if (!quizId) return showMessage($("#msg"), "Quiz inválido.");
  try {
    quiz = await api(`/quizzes/${quizId}`);
    renderIntro();
  } catch (error) {
    showMessage($("#msg"), error.message);
  }
}

function renderIntro() {
  stage.replaceChildren(el("div", { class: "card" },
    el("h1", {}, quiz.title),
    el("p", { class: "muted" }, quiz.description),
    el("p", {}, `${quiz.question_count} perguntas · ${quiz.total_points} pontos · dificuldade ${DIFFICULTY[quiz.difficulty]}`),
    quiz.time_limit
      ? el("p", {}, `Tempo limite: ${fmtTime(quiz.time_limit)}. Ao acabar o tempo, o quiz é enviado automaticamente.`)
      : null,
    el("p", { class: "muted" }, "Acertando 70% ou mais, você recebe o certificado de conclusão."),
    el("button", { class: "btn", type: "button", onclick: start }, "Iniciar quiz")));
}

function tick() {
  const left = remaining();
  const timer = $("#timer");
  if (timer) {
    timer.textContent = fmtTime(left);
    timer.classList.toggle("low", left <= 30);
  }
  if (left === 0) finish(true);
}

function start() {
  startedAt = Date.now();
  if (quiz.time_limit) timerId = setInterval(tick, 500);
  renderQuestion();
}

function renderQuestion() {
  const question = quiz.questions[current];
  const last = current === quiz.questions.length - 1;
  stage.replaceChildren(
    el("div", { class: "quiz-head" },
      el("strong", {}, `Pergunta ${current + 1} de ${quiz.questions.length}`),
      quiz.time_limit
        ? el("span", { class: "timer", id: "timer", role: "timer" }, fmtTime(remaining()))
        : null),
    el("div", { class: "progress", "aria-hidden": "true" },
      el("div", { style: `width:${(current / quiz.questions.length) * 100}%` })),
    el("div", { class: "card" },
      el("p", { class: "question" }, question.text),
      el("div", { class: "options", role: "group", "aria-label": "Alternativas" },
        question.alternatives.map((alt, index) => el("button", {
          type: "button", class: "option", "aria-pressed": String(chosen.get(question.id) === alt.id),
          onclick: () => { chosen.set(question.id, alt.id); renderQuestion(); },
        }, el("span", { class: "key", "aria-hidden": "true" }, "ABCDEF"[index]), el("span", {}, alt.text)))),
      el("div", { class: "quiz-nav" },
        el("button", {
          class: "btn secondary", type: "button", disabled: current === 0,
          onclick: () => { current--; renderQuestion(); },
        }, "Anterior"),
        last
          ? el("button", { class: "btn", type: "button", onclick: () => finish(false) }, "Finalizar")
          : el("button", { class: "btn", type: "button", onclick: () => { current++; renderQuestion(); } }, "Próxima"))));
}

async function finish(timeUp) {
  if (submitting) return;
  const unanswered = quiz.questions.length - chosen.size;
  if (!timeUp && unanswered && !confirm(`Você deixou ${unanswered} pergunta(s) sem resposta. Finalizar mesmo assim?`)) return;

  submitting = true;
  clearInterval(timerId);
  stage.replaceChildren(el("p", { class: "muted", role: "status" }, "Corrigindo…"));
  try {
    const answers = quiz.questions.map((q) => ({ question_id: q.id, alternative_id: chosen.get(q.id) ?? null }));
    const time_spent = Math.round((Date.now() - startedAt) / 1000);
    const result = await api(`/quizzes/${quiz.id}/submit`, { method: "POST", body: { answers, time_spent } });
    location.href = `resultado.html?id=${result.id}`;
  } catch (error) {
    submitting = false;
    showMessage($("#msg"), error.message);
    renderQuestion();
    if (quiz.time_limit && remaining() > 0) timerId = setInterval(tick, 500);
  }
}

load();
