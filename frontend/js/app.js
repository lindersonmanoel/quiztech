// Utilitários compartilhados: API, sessão, navegação e helpers de DOM.
// Todo conteúdo dinâmico entra via textContent (nunca innerHTML) para evitar XSS.

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

function errorMessage(data, status) {
  const detail = data && data.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) return detail.map((d) => d.msg).join("; ");
  return `Erro ${status}`;
}

export async function api(path, { method = "GET", body } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, "Sem conexão com o servidor. Tente novamente.");
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token) clearSession(); // token expirado ou inválido
    throw new ApiError(res.status, errorMessage(data, res.status));
  }
  return data;
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

export const DIFFICULTY = { facil: "Fácil", media: "Média", dificil: "Difícil" };

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

export function renderNav() {
  const page = location.pathname.split("/").pop() || "index.html";
  const user = getUser();
  const link = (href, label) => el("a", { href, "aria-current": page === href ? "page" : false }, label);
  const links = [link("quizzes.html", "Quizzes"), link("ranking.html", "Ranking")];
  if (user) {
    links.push(link("perfil.html", "Meu perfil"));
    links.push(el("button", { type: "button", onclick: () => { clearSession(); location.href = "index.html"; } }, "Sair"));
  } else {
    links.push(link("login.html", "Entrar"), el("a", { class: "btn small", href: "cadastro.html" }, "Cadastrar"));
  }
  const nav = el("header", { class: "nav" },
    el("div", { class: "nav-inner" },
      el("a", { class: "brand", href: "index.html" },
        el("img", { src: "assets/logo/logo.png", alt: "" }),
        el("span", {}, "QUIZ ", el("b", {}, "TECH"))),
      el("nav", { class: "nav-links", "aria-label": "Principal" }, links)));
  document.body.prepend(nav);
  document.body.append(el("footer", {}, "QUIZ TECH · Aprenda, teste e certifique seus conhecimentos em tecnologia"));
}
