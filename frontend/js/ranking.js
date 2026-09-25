import { api, el, icone, renderNav, showMessage, $ } from "./app.js";

renderNav();

// 1o, 2o e 3o lugar: troféu em ouro, prata e bronze (a cor vem do CSS); do 4o em diante, o número.
const MEDALHAS = ["ouro", "prata", "bronze"];
const posicao = (n) => (MEDALHAS[n - 1]
  ? el("span", { class: `medalha ${MEDALHAS[n - 1]}`, title: `${n}º lugar` }, icone("trophy", { tamanho: 22 }), el("span", { class: "sr-only" }, `${n}º lugar`))
  : n);

async function loadRanking() {
  const category = $("#category").value;
  try {
    const rows = await api(`/ranking${category ? `?category_id=${category}` : ""}`);
    showMessage($("#msg"), "");
    $("#rows").replaceChildren(...(rows.length
      ? rows.map((r) => el("tr", {},
        el("td", {}, posicao(r.position)),
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
    $("#category").append(...categories.map((c) => el("option", { value: c.id }, c.name)));
  } catch { /* o filtro fica só com "Todas as áreas" */ }
  $("#category").addEventListener("change", loadRanking);
  loadRanking();
})();
