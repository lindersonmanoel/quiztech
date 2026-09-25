import { api, el, renderNav, $ } from "./app.js";

renderNav();

(async () => {
  try {
    const [categories, quizzes] = await Promise.all([api("/categories"), api("/quizzes")]);
    const questions = quizzes.reduce((sum, q) => sum + q.question_count, 0);
    const stat = (value, label) => el("div", { class: "card stat" }, el("strong", {}, value), label);
    $("#stats").replaceChildren(
      stat(categories.length, "áreas"),
      stat(quizzes.length, "quizzes"),
      stat(questions, "perguntas"),
      stat("70%", "para certificar"),
    );
    $("#areas").replaceChildren(...categories.map((c) =>
      el("a", { class: "chip", href: `quizzes.html?category=${c.id}`, style: "text-decoration:none" }, `${c.icon} ${c.name}`)));
  } catch {
    $("#stats").replaceChildren(el("p", { class: "muted" }, "Não foi possível carregar os dados agora."));
  }
})();
