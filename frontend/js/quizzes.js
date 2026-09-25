import { api, DIFFICULTY, el, params, renderNav, $ } from "./app.js";

renderNav();

let categories = [];
let quizzes = [];
let group = "";
let query = "";
const onlyCategory = Number(params().get("category")) || null; // vem dos atalhos da página inicial

function render() {
  const cats = new Map(categories.map((c) => [c.id, c]));
  const term = query.trim().toLowerCase();
  const visible = quizzes.filter((q) => {
    const cat = cats.get(q.category_id);
    if (!cat) return false;
    if (onlyCategory && q.category_id !== onlyCategory) return false;
    if (group && cat.group !== group) return false;
    return !term || `${q.title} ${cat.name} ${cat.group} ${cat.description}`.toLowerCase().includes(term);
  });

  const byGroup = new Map();
  for (const quiz of visible) {
    const key = cats.get(quiz.category_id).group;
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push(quiz);
  }

  const sections = [...byGroup].map(([name, items]) => el("section", {},
    el("h2", { class: "group-title" }, name),
    el("div", { class: "grid" }, items.map((q) => {
      const cat = cats.get(q.category_id);
      return el("article", { class: "card quiz-card" },
        el("div", { class: "icon", "aria-hidden": "true" }, cat.icon),
        el("h3", {}, cat.name),
        el("p", { class: "muted" }, cat.description),
        el("div", { class: "meta" },
          el("span", { class: "badge" }, DIFFICULTY[q.difficulty]),
          ` ${q.question_count} perguntas · ${q.total_points} pontos`),
        el("a", { class: "btn small", href: `quiz.html?id=${q.id}` }, "Começar"));
    }))));

  $("#list").replaceChildren(...(sections.length
    ? sections
    : [el("p", { class: "muted" }, "Nenhum quiz encontrado para esse filtro.")]));
}

function renderFilters() {
  const groups = ["", ...new Set(categories.map((c) => c.group))];
  $("#filters").replaceChildren(...groups.map((g) =>
    el("button", {
      type: "button", class: "chip", "aria-pressed": String(group === g),
      onclick: () => { group = g; renderFilters(); render(); },
    }, g || "Todos")));
}

$("#search").addEventListener("input", (event) => { query = event.target.value; render(); });

(async () => {
  try {
    [categories, quizzes] = await Promise.all([api("/categories"), api("/quizzes")]);
    renderFilters();
    render();
  } catch (error) {
    $("#list").replaceChildren(el("div", { class: "msg error", role: "alert" }, error.message));
  }
})();
