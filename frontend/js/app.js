// Utilitários compartilhados: API, sessão, navegação e helpers de DOM.
// Todo conteúdo dinâmico entra via textContent (nunca innerHTML) para evitar XSS.

import { initPwa } from "./pwa.js";
import { icone, montarIcones } from "./icons.js";
import { APP_VERSION, CHANGELOG } from "./versao.js";
import "./dispositivo.js"; // marca o tipo de aparelho (celular, tablet, computador, TV) e liga a navegação por setas na TV

export { icone };

const TOKEN_KEY = "quiztech_token";
const USER_KEY = "quiztech_user";

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function getUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; }
}

export function setSession(token, user) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch { /* armazenamento indisponível: a sessão vale só até recarregar */ }
}

export function clearSession() {
  try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); } catch { /* ignore */ }
}

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// A API responde { erro, campos? }: "erro" e' a mensagem geral e "campos" traz o motivo de cada campo invalido.
function errorMessage(data, status) {
  if (data && typeof data.erro === "string") {
    const campos = data.campos && typeof data.campos === "object" ? Object.values(data.campos).filter((c) => typeof c === "string") : [];
    return campos.length ? campos.join(" ") : data.erro;
  }
  return `Erro ${status}`;
}

export const apiBase = () => window.API_BASE_URL || "/api";

export async function api(path, { method = "GET", body } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let res;
  try {
    res = await fetch(`${apiBase()}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, "Sem conexão com o servidor. Tente novamente.");
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token) {
      clearSession(); // token expirado ou inválido
      if (document.body.dataset.auth === "required") {
        const here = location.pathname.split("/").pop() + location.search;
        location.replace(`login.html?next=${encodeURIComponent(here)}`);
      }
    }
    throw new ApiError(res.status, errorMessage(data, res.status));
  }
  return data;
}

/** GET que devolve texto (ex.: o QR Code em SVG). Devolve null em qualquer falha: quem chama decide o que mostrar. */
export async function apiText(path) {
  try {
    const res = await fetch(`${apiBase()}${path}`);
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value == null) continue;
    if (key === "class") node.className = value;
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export const $ = (selector, root = document) => root.querySelector(selector);

export function showMessage(container, text, kind = "error") {
  container.replaceChildren(text ? el("div", { class: `msg ${kind}`, role: kind === "error" ? "alert" : "status" }, text) : "");
}

export const params = () => new URLSearchParams(location.search);

export function fmtTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export const DIFFICULTY = { facil: "Fácil", media: "Médio", dificil: "Difícil" };
export const NIVEIS = ["facil", "media", "dificil"];

// Só aceita destinos internos simples (ex.: "quiz.html?id=3") para o parâmetro ?next=.
export function safeNext(value, fallback = "quizzes.html") {
  return typeof value === "string" && /^[a-z0-9_-]+\.html(\?[a-zA-Z0-9=&_.-]*)?$/.test(value) ? value : fallback;
}

export function requireLogin() {
  if (!getToken()) {
    const here = location.pathname.split("/").pop() + location.search;
    location.replace(`login.html?next=${encodeURIComponent(here)}`);
    return false;
  }
  return true;
}

// ---------- Versão e aviso de atualização ----------
const VERSION_CHECK_MS = 5 * 60 * 1000; // confere a cada 5 min e quando a aba volta ao foco
let loadedBuild = null;
let dismissedBuild = null;

const buildId = (build) => `${build.version}+${build.commit}`;

async function fetchBuild() {
  try {
    const res = await fetch(`${apiBase()}/version`, { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

const versaoNumerica = (v) => String(v).split(".").map((n) => Number(n) || 0);
function maiorQue(a, b) {
  const [x, y] = [versaoNumerica(a), versaoNumerica(b)];
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}

/** Lê o histórico de novidades MAIS RECENTE do servidor (a página aberta ainda tem o antigo na memória). */
async function historicoAtualizado() {
  try {
    const novo = await import(`./versao.js?atualizado=${Date.now()}`);
    return { versao: novo.APP_VERSION, historico: novo.CHANGELOG };
  } catch {
    return { versao: APP_VERSION, historico: CHANGELOG };
  }
}

/** "Nova versão disponível" com o que mudou. `build` (opcional) é a versão da API, quando foi ela que mudou. */
async function showUpdateBanner(build) {
  const id = build ? buildId(build) : "site";
  if (document.getElementById("update-banner") || id === dismissedBuild) return;
  const { versao, historico } = await historicoAtualizado();
  if (document.getElementById("update-banner")) return;
  const novidades = historico.filter((item) => maiorQue(item.versao, APP_VERSION));
  const mudancas = (novidades.length ? novidades : historico.slice(0, 1)).flatMap((item) => item.mudancas).slice(0, 4);
  const onQuiz = location.pathname.endsWith("quiz.html"); // não recarrega no meio de um quiz
  const banner = el("div", { id: "update-banner", class: "update-banner", role: "status" },
    el("div", { class: "update-linha" },
      icone("download", { tamanho: 20 }),
      el("strong", {}, `Nova versão disponível (v${maiorQue(versao, APP_VERSION) ? versao : (build ? build.version : versao)})`),
      onQuiz ? el("span", { class: "muted" }, "Conclua o quiz e, em seguida, atualize a página.") : null,
      onQuiz ? null : el("button", { class: "btn small", type: "button", onclick: () => location.reload() }, "Atualizar agora"),
      el("button", {
        class: "btn small secondary", type: "button", "aria-label": "Fechar o aviso de atualização",
        onclick: () => { dismissedBuild = id; banner.remove(); },
      }, "Mais tarde")),
    mudancas.length ? el("ul", { class: "update-lista" }, mudancas.map((texto) => el("li", {}, texto))) : null);
  document.body.append(banner);
}

// O site (arquivos) foi atualizado: um service worker novo assumiu a página que já estava aberta.
document.addEventListener("quiztech:atualizado", () => showUpdateBanner(null));

async function initVersion() {
  const build = await fetchBuild();
  if (!build) return;
  loadedBuild = buildId(build);
  const label = document.getElementById("app-version");
  if (label) {
    label.textContent = `v${APP_VERSION}${build.environment === "production" ? "" : ` · ${build.environment}`}`;
    label.title = `QUIZ TECH ${APP_VERSION} · servidor ${build.version} (commit ${build.commit}), ambiente ${build.environment}`;
  }
  const check = async () => {
    const latest = await fetchBuild();
    if (latest && buildId(latest) !== loadedBuild) showUpdateBanner(latest);
  };
  setInterval(check, VERSION_CHECK_MS);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
}

export function renderNav() {
  const page = location.pathname.split("/").pop() || "index.html";
  const user = getUser();
  const link = (href, label) => el("a", { href, "aria-current": page === href ? "page" : false }, label);
  const links = [link("quizzes.html", "Quizzes"), link("ranking.html", "Ranking"), link("ajuda.html", "Ajuda")];
  // Botao de instalar o app (PWA): so' aparece no Android e enquanto o app nao esta instalado (veja pwa.js).
  links.push(el("button", { type: "button", class: "btn small install-btn", "data-install": "", hidden: true, "aria-label": "Instalar o aplicativo QUIZ TECH" }, icone("download", { tamanho: 16 }), " Instalar app"));
  if (user) {
    if (user.is_admin) links.push(link("admin.html", "Painel"));
    links.push(link("perfil.html", "Meu perfil"));
    links.push(el("button", { type: "button", onclick: () => { clearSession(); location.href = "index.html"; } }, "Sair"));
  } else {
    links.push(link("login.html", "Entrar"), el("a", { class: "btn small", href: "cadastro.html" }, "Cadastrar"));
  }
  const nav = el("header", { class: "nav" },
    el("div", { class: "nav-inner" },
      el("a", { class: "brand", href: "index.html" },
        el("img", { src: "assets/logo/marca.svg", alt: "", width: 40, height: 40 }),
        el("span", {}, "QUIZ ", el("b", {}, "TECH"))),
      el("nav", { class: "nav-links", "aria-label": "Principal" }, links)));
  document.body.prepend(nav);
  document.body.append(el("footer", {}, el("img", { src: "assets/logo/marca.svg", alt: "", width: 26, height: 26 }), "QUIZ TECH · Aprenda, teste e certifique os seus conhecimentos em tecnologia", el("a", { href: "ajuda.html" }, "Ajuda"), el("a", { href: "privacidade.html" }, "Política de Privacidade"), el("span", { id: "app-version", class: "app-version" })));
  initVersion();
  montarIcones();
  initPwa();
  // Tutorial de boas-vindas, tour de cada página e botão "?": carregados depois, para não atrasar a página.
  import("./tutorial.js").then((t) => t.iniciarTutorial()).catch(() => { /* o site funciona igual sem o tutorial */ });
}
