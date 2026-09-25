import { api, el, fmtTime, params, renderNav, requireLogin, showMessage, $ } from "./app.js";

renderNav();

async function load() {
  if (!requireLogin()) return;
  const id = Number(params().get("id"));
  if (!id) return showMessage($("#msg"), "Resultado inválido.");
  try {
    render(await api(`/results/${id}`));
  } catch (error) {
    showMessage($("#msg"), error.message);
  }
}

function render(r) {
  const cert = r.certificate;
  $("#result").replaceChildren(
    el("div", { class: `card score${r.passed ? "" : " fail"}` },
      el("h1", {}, r.passed ? "Parabéns, você foi aprovado!" : "Quase lá! Continue praticando"),
      el("p", { class: "muted" }, r.quiz_title),
      el("div", { class: "big" }, `${r.percentage}%`),
      el("p", {}, `${r.score} de ${r.max_score} pontos · ${r.correct_answers} acertos · ${r.wrong_answers} erros · tempo ${fmtTime(r.time_spent)}`),
      cert
        ? el("p", {}, el("a", { class: "btn", href: `certificado.html?code=${encodeURIComponent(cert.code)}` }, "Ver meu certificado"))
        : el("p", { class: "muted" }, "Você precisa de 70% de acertos ou mais. O gabarito é liberado após a aprovação; estude o conteúdo e tente de novo em alguns minutos."),
      el("div", { class: "actions" },
        el("a", { class: "btn secondary", href: `quiz.html?id=${r.quiz_id}` }, "Refazer quiz"),
        el("a", { class: "btn secondary", href: "quizzes.html" }, "Outros quizzes"),
        el("a", { class: "btn secondary", href: "ranking.html" }, "Ver ranking"))),
    el("h2", { style: "margin-top:28px" }, "Revisão das respostas"),
    el("div", { class: "review" }, r.review.map((item, index) =>
      el("div", { class: `card review-item${item.is_correct ? " right" : ""}` },
        el("strong", {}, `${index + 1}. ${item.question}`),
        el("p", { class: "answer" }, item.is_correct ? "✅ Você acertou: " : "❌ Sua resposta: ",
          item.chosen_text ?? "(sem resposta)"),
        item.is_correct
          ? null
          : item.correct_text
            ? el("p", { class: "answer" }, "Resposta correta: ", el("strong", {}, item.correct_text))
            : el("p", { class: "answer muted" }, "O gabarito é liberado depois da aprovação."),
        el("span", { class: "badge" }, `${item.is_correct ? item.points : 0} / ${item.points} pontos`)))));
}

load();
