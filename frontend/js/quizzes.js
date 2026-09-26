import { api, DIFFICULTY, NIVEIS, el, getToken, icone, params, renderNav, $ } from "./app.js";

renderNav();

let categories = [];
let quizzes = [];
let certified = new Set(); // ids dos quizzes em que a pessoa logada ja tem certificado
let group = "";
let level = ""; // "" = todos os niveis
let query = "";
const onlyCategory = Number(params().get("category")) || null; // vem dos atalhos da página inicial

function levelRow(quiz) {
  const done = certified.has(quiz.id);
  return el("li", { class: `level-row${done ? " done" : ""}` },
    el("span", { class: `badge nivel-${quiz.difficulty}` }, DIFFICULTY[quiz.difficulty]),
    el("span", { class: "level-info muted" }, `${quiz.question_count} perguntas · ${quiz.total_points} pontos`),
    done ? el("span", { class: "level-done", title: "Você já possui o certificado deste nível" }, icone("check-circle", { tamanho: 16 }), el("span", { class: "sr-only" }, "Certificado obtido")) : null,
    el("a", { class: "btn small", href: `quiz.html?id=${quiz.id}`, "aria-label": `${done ? "Refazer" : "Começar"} o nível ${DIFFICULTY[quiz.difficulty]}` }, done ? "Refazer" : "Começar"));
}

function render() {
  const cats = new Map(categories.map((c) => [c.id, c]));
  const term = query.trim().toLowerCase();

  // Um cartao por area, com os quizzes (niveis) que passam nos filtros.
  const byCategory = new Map();
  for (const quiz of quizzes) {
    const cat = cats.get(quiz.category_id);
    if (!cat) continue;
    if (onlyCategory && quiz.category_id !== onlyCategory) continue;
    if (group && cat.group !== group) continue;
    if (level && quiz.difficulty !== level) continue;
    if (term && !`${cat.name} ${cat.group} ${cat.description} ${quiz.title}`.toLowerCase().includes(term)) continue;
    if (!byCategory.has(cat.id)) byCategory.set(cat.id, []);
    byCategory.get(cat.id).push(quiz);
  }

  const byGroup = new Map();
  for (const [categoryId, items] of byCategory) {
    const cat = cats.get(categoryId);
    if (!byGroup.has(cat.group)) byGroup.set(cat.group, []);
    items.sort((a, b) => NIVEIS.indexOf(a.difficulty) - NIVEIS.indexOf(b.difficulty));
    byGroup.get(cat.group).push({ cat, items });
  }

  const sections = [...byGroup].map(([name, areas]) => el("section", {},
    el("h2", { class: "group-title" }, name),
    el("div", { class: "grid" }, areas.map(({ cat, items }) =>
      el("article", { class: "card quiz-card" },
        el("div", { class: "icon", "aria-hidden": "true" }, icone(cat.icon, { tamanho: 28 })),
        el("h3", {}, cat.name),
        el("p", { class: "muted" }, cat.description),
        el("ul", { class: "levels", "aria-label": `Níveis de ${cat.name}` }, items.map(levelRow)))))));

  $("#list").replaceChildren(...(sections.length
    ? sections
    : [el("p", { class: "muted" }, "Nenhum quiz encontrado para o filtro selecionado.")]));
}

function renderFilters() {
  const groups = ["", ...new Set(categories.map((c) => c.group))];
  $("#filters").replaceChildren(...groups.map((g) =>
    el("button", {
      type: "button", class: "chip", "aria-pressed": String(group === g),
      onclick: () => { group = g; renderFilters(); render(); },
    }, g || "Todos")));

  $("#levels").replaceChildren(...["", ...NIVEIS].map((n) =>
    el("button", {
      type: "button", class: "chip", "aria-pressed": String(level === n),
      onclick: () => { level = n; renderFilters(); render(); },
    }, n ? DIFFICULTY[n] : "Todos os níveis")));
}

$("#search").addEventListener("input", (event) => { query = event.target.value; render(); });

(async () => {
  try {
    const carregar = [api("/categories"), api("/quizzes")];
    // Quem esta logado ve quais niveis ja rendeu certificado (falha aqui nao atrapalha a lista).
    if (getToken()) carregar.push(api("/certificates").catch(() => []));
    const [cats, list, certs] = await Promise.all(carregar);
    categories = cats;
    quizzes = list;
    certified = new Set((certs || []).map((c) => c.quiz_id));
    renderFilters();
    render();
  } catch (error) {
    $("#list").replaceChildren(el("div", { class: "msg error", role: "alert" }, error.message));
  }
})();
