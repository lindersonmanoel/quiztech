import { api, DIFFICULTY, el, fmtTime, params, renderNav, requireLogin, showMessage, $ } from "./app.js";
import { ajudaVisivel } from "./tutorial.js";

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
    el("p", {}, `${quiz.question_count} perguntas · ${quiz.total_points} pontos · nível ${DIFFICULTY[quiz.difficulty]}`),
    quiz.time_limit
      ? el("p", {}, `Tempo limite: ${fmtTime(quiz.time_limit)}. Ao acabar o tempo, o quiz é enviado automaticamente.`)
      : null,
    el("p", { class: "muted" }, "Acertando 70% ou mais, você recebe o certificado de conclusão."),
    el("div", { class: "dica" },
      el("h2", { class: "dica-titulo" }, "Como responder"),
      el("ul", {},
        el("li", {}, "Leia a pergunta e toque (ou clique) na alternativa que você acha certa. Toque de novo em outra para mudar."),
        el("li", {}, "Use “Anterior” e “Próxima” para navegar. Você pode voltar e trocar respostas antes de finalizar."),
        el("li", {}, "Teclado e controle remoto: as teclas A a F (ou 1 a 6) escolhem a alternativa; Tab e Enter navegam e confirmam."),
        el("li", {}, "Ao tocar em “Finalizar”, o quiz é corrigido na hora e você vê o resultado."),
        el("li", {}, "Quiz com tempo: quando o relógio zera, as respostas são enviadas sozinhas."))),
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
  ajudaVisivel(false); // sem distrações enquanto o tempo corre
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

// Atalhos de teclado (e de controle remoto com teclas numéricas): A–F ou 1–6 escolhem a alternativa da pergunta atual.
document.addEventListener("keydown", (evento) => {
  if (evento.ctrlKey || evento.metaKey || evento.altKey || submitting || !quiz || !startedAt) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
  const indice = "abcdef".indexOf(evento.key.toLowerCase());
  const numero = /^[1-6]$/.test(evento.key) ? Number(evento.key) - 1 : -1;
  const posicao = evento.key.length === 1 ? (indice >= 0 ? indice : numero) : -1;
  const pergunta = quiz.questions[current];
  if (posicao < 0 || !pergunta || !pergunta.alternatives[posicao]) return;
  evento.preventDefault();
  chosen.set(pergunta.id, pergunta.alternatives[posicao].id);
  renderQuestion();
  $(".option[aria-pressed=\"true\"]")?.focus();
});

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
