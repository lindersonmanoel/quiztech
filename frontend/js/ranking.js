import { api, el, renderNav, showMessage, $ } from "./app.js";

renderNav();

const MEDALS = ["🥇", "🥈", "🥉"];

async function loadRanking() {
  const category = $("#category").value;
  try {
    const rows = await api(`/ranking${category ? `?category_id=${category}` : ""}`);
    showMessage($("#msg"), "");
    $("#rows").replaceChildren(...(rows.length
      ? rows.map((r) => el("tr", {},
        el("td", {}, MEDALS[r.position - 1] ?? r.position),
        el("td", {}, r.user_name),
        el("td", {}, r.total_score),
        el("td", {}, r.quizzes_completed)))
      : [el("tr", {}, el("td", { colspan: "4", class: "muted" }, "Ainda não há resultados nesta área. Seja o primeiro!"))]));
  } catch (error) {
    showMessage($("#msg"), error.message);
  }
}

(async () => {
  try {
    const categories = await api("/categories");
    $("#category").append(...categories.map((c) => el("option", { value: c.id }, `${c.icon} ${c.name}`)));
  } catch { /* o filtro fica só com "Todas as áreas" */ }
  $("#category").addEventListener("change", loadRanking);
  loadRanking();
})();
