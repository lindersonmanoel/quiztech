import { api, DIFFICULTY, NIVEIS, el, icone, params, renderNav, showMessage, $ } from "./app.js";

renderNav();

// Semana = de segunda a domingo; mes = mes do calendario. O servidor conta no fuso do Brasil (America/Sao_Paulo).
const PERIODOS = [
  { id: "all", rotulo: "Geral" },
  { id: "month", rotulo: "Este mês" },
  { id: "week", rotulo: "Esta semana" },
];
const FUSO = "America/Sao_Paulo";

// 1o, 2o e 3o lugar: troféu em ouro, prata e bronze (a cor vem do CSS); do 4o em diante, o número.
const MEDALHAS = ["ouro", "prata", "bronze"];
const posicao = (n) => (MEDALHAS[n - 1]
  ? el("span", { class: `medalha ${MEDALHAS[n - 1]}`, title: `${n}º lugar` }, icone("trophy", { tamanho: 22 }), el("span", { class: "sr-only" }, `${n}º lugar`))
  : n);

const inicial = params();
let period = PERIODOS.some((p) => p.id === inicial.get("period")) ? inicial.get("period") : "all";

/** Data de hoje no fuso do Brasil, como componentes (para calcular a segunda-feira e o nome do mes). */
function hojeNoBrasil() {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const v = Object.fromEntries(partes.map((p) => [p.type, Number(p.value)]));
  return new Date(Date.UTC(v.year, v.month - 1, v.day));
}

function notaDoPeriodo() {
  const hoje = hojeNoBrasil();
  const fmt = (d, opcoes) => d.toLocaleDateString("pt-BR", { timeZone: "UTC", ...opcoes });
  if (period === "week") {
    const segunda = new Date(hoje);
    segunda.setUTCDate(hoje.getUTCDate() - ((hoje.getUTCDay() + 6) % 7));
    const domingo = new Date(segunda);
    domingo.setUTCDate(segunda.getUTCDate() + 6);
    return `Semana de ${fmt(segunda, { day: "2-digit", month: "2-digit" })} a ${fmt(domingo, { day: "2-digit", month: "2-digit" })}. O ranking recomeça toda segunda-feira.`;
  }
  if (period === "month") return `Mês de ${fmt(hoje, { month: "long", year: "numeric" })}. O ranking recomeça no dia 1.`;
  return "Pontuação acumulada desde o início.";
}

function renderPeriods() {
  $("#periods").replaceChildren(...PERIODOS.map((p) => el("button", {
    type: "button", class: "chip", "aria-pressed": String(period === p.id),
    onclick: () => { period = p.id; renderPeriods(); loadRanking(); },
  }, p.rotulo)));
  $("#period-note").textContent = notaDoPeriodo();
}

function guardarNaUrl() {
  const q = new URLSearchParams();
  if (period !== "all") q.set("period", period);
  if ($("#category").value) q.set("category", $("#category").value);
  if ($("#level").value) q.set("level", $("#level").value);
  const texto = q.toString();
  history.replaceState(null, "", location.pathname + (texto ? `?${texto}` : ""));
}

async function loadRanking() {
  guardarNaUrl();
  const q = new URLSearchParams({ period });
  if ($("#category").value) q.set("category_id", $("#category").value);
  if ($("#level").value) q.set("difficulty", $("#level").value);
  try {
    const rows = await api(`/ranking?${q}`);
    showMessage($("#msg"), "");
    const vazio = period === "all" ? "Ainda não há resultados aqui. Seja o primeiro!" : "Ninguém pontuou neste período ainda. Seja o primeiro!";
    $("#rows").replaceChildren(...(rows.length
      ? rows.map((r) => el("tr", {},
        el("td", {}, posicao(r.position)),
        el("td", {}, r.user_name),
        el("td", {}, r.total_score),
        el("td", {}, r.quizzes_completed)))
      : [el("tr", {}, el("td", { colspan: "4", class: "muted" }, vazio))]));
  } catch (error) {
    showMessage($("#msg"), error.message);
  }
}

(async () => {
  $("#level").append(...NIVEIS.map((n) => el("option", { value: n }, DIFFICULTY[n])));
  if (NIVEIS.includes(inicial.get("level"))) $("#level").value = inicial.get("level");
  renderPeriods();
  try {
    const categories = await api("/categories");
    $("#category").append(...categories.map((c) => el("option", { value: c.id }, c.name)));
    if (categories.some((c) => String(c.id) === inicial.get("category"))) $("#category").value = inicial.get("category");
  } catch { /* o filtro fica só com "Todas as áreas" */ }
  $("#category").addEventListener("change", loadRanking);
  $("#level").addEventListener("change", loadRanking);
  loadRanking();
})();
