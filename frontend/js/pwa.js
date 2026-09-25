// PWA: registro do service worker e botao "Instalar app" para os navegadores Android.
//  - Chrome, Edge, Samsung Internet, Opera, Brave e Vivaldi disparam "beforeinstallprompt": o botao abre a instalacao nativa.
//  - Firefox (e navegadores que nao oferecem o pedido automatico) recebem um passo a passo do proprio navegador.
//  - Navegadores embutidos (Instagram, Facebook, WhatsApp...) nao instalam: o aviso manda abrir no navegador.
// Os botoes sao os elementos com o atributo [data-install]; ficam ocultos quando o app ja esta instalado.

const ANDROID = /Android/i.test(navigator.userAgent);

let pedidoAdiado = null; // evento beforeinstallprompt guardado para disparar no clique
let instalado = false;

const emModoApp = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.matchMedia("(display-mode: fullscreen)").matches ||
  window.matchMedia("(display-mode: minimal-ui)").matches ||
  window.navigator.standalone === true;

// Escuta ja na carga do modulo: o evento pode chegar antes de a pagina montar a navegacao.
window.addEventListener("beforeinstallprompt", (evento) => {
  evento.preventDefault(); // guarda para usar no clique do nosso botao
  pedidoAdiado = evento;
  atualizarBotoes();
});
window.addEventListener("appinstalled", () => {
  pedidoAdiado = null;
  instalado = true;
  atualizarBotoes();
  avisar("App instalado! Procure o ícone QUIZ TECH na tela inicial.");
});

/** Detecta o navegador para mostrar o passo a passo certo. */
export function detectarNavegador(ua = navigator.userAgent) {
  if (/; wv\)|FBAN|FBAV|Instagram|Line\/|MicroMessenger|Snapchat|TikTok|GSA\//i.test(ua)) return "embutido";
  if (/SamsungBrowser/i.test(ua)) return "samsung";
  if (/Firefox|FxiOS/i.test(ua)) return "firefox";
  if (/EdgA|EdgiOS|Edg\//i.test(ua)) return "edge";
  if (/OPR\/|OPT\/|Opera/i.test(ua)) return "opera";
  if (/DuckDuckGo/i.test(ua)) return "duckduckgo";
  if (/Vivaldi/i.test(ua)) return "vivaldi";
  if (/Chrome|CriOS/i.test(ua)) return "chrome";
  return "outro";
}

const PASSOS = {
  chrome: ["Toque no menu ⋮ (canto superior direito).", "Toque em “Instalar app” (ou “Adicionar à tela inicial”).", "Confirme em “Instalar”."],
  edge: ["Toque no menu ⋯ (parte inferior da tela).", "Toque em “Adicionar ao telefone” (ou “Instalar”).", "Confirme a instalação."],
  firefox: ["Toque no menu ⋮ (canto superior direito).", "Toque em “Instalar” (ou “Adicionar à tela inicial”).", "Confirme em “Adicionar”."],
  samsung: ["Toque no menu ☰ (parte inferior da tela).", "Toque em “Adicionar página a” e escolha “Tela inicial”.", "Confirme em “Adicionar”."],
  opera: ["Toque no menu ⋮ (ou no ícone do Opera).", "Toque em “Adicionar à tela inicial” (ou “Instalar”).", "Confirme a instalação."],
  duckduckgo: ["Toque no menu ⋮.", "Toque em “Adicionar à tela inicial”.", "Confirme em “Adicionar”."],
  vivaldi: ["Toque no menu do Vivaldi (ícone V).", "Toque em “Adicionar à tela inicial”.", "Confirme em “Adicionar”."],
  outro: ["Abra o menu do seu navegador (⋮ ou ☰).", "Procure “Instalar app” ou “Adicionar à tela inicial”.", "Confirme."],
  embutido: ["Você está dentro de outro aplicativo (Instagram, Facebook, WhatsApp...), que não permite instalar.", "Toque no menu ⋮ e escolha “Abrir no navegador” (ou copie o endereço).", "Abra no Chrome (ou no seu navegador) e toque em “Instalar app”."],
};

const NOMES = {
  chrome: "Chrome", edge: "Microsoft Edge", firefox: "Firefox", samsung: "Samsung Internet", opera: "Opera",
  duckduckgo: "DuckDuckGo", vivaldi: "Vivaldi", outro: "seu navegador", embutido: "este aplicativo",
};

function el(tag, attrs = {}, ...filhos) {
  const no = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") no.className = v;
    else if (k.startsWith("on")) no.addEventListener(k.slice(2), v);
    else no.setAttribute(k, v);
  }
  no.append(...filhos);
  return no;
}

function avisar(texto) {
  const aviso = el("div", { class: "toast", role: "status" }, texto);
  document.body.append(aviso);
  setTimeout(() => aviso.remove(), 6000);
}

function abrirInstrucoes() {
  const navegador = detectarNavegador();
  const passos = PASSOS[navegador] || PASSOS.outro;
  const dialogo = el("dialog", { class: "install-dialog", "aria-labelledby": "install-titulo" },
    el("h2", { id: "install-titulo" }, "Instalar o QUIZ TECH"),
    el("p", { class: "muted" }, navegador === "embutido" ? "Este navegador não instala aplicativos." : `Instalação pelo ${NOMES[navegador]}:`),
    el("ol", {}, ...passos.map((p) => el("li", {}, p))),
    el("p", { class: "muted" }, "O ícone aparece na tela inicial e o site abre como um aplicativo, em tela cheia."),
    el("button", { class: "btn block", type: "button", onclick: () => dialogo.close() }, "Entendi"));
  dialogo.addEventListener("close", () => dialogo.remove());
  document.body.append(dialogo);
  if (typeof dialogo.showModal === "function") dialogo.showModal();
  else { dialogo.setAttribute("open", ""); }
}

async function instalar() {
  if (pedidoAdiado) {
    const pedido = pedidoAdiado;
    pedidoAdiado = null; // o navegador so' deixa usar cada pedido uma vez
    try {
      pedido.prompt();
      await pedido.userChoice;
    } catch (e) { /* o usuario fechou ou o navegador recusou: nada a fazer */ }
    atualizarBotoes();
    return;
  }
  abrirInstrucoes();
}

const deveMostrar = () => !instalado && !emModoApp() && (ANDROID || pedidoAdiado !== null);

function atualizarBotoes() {
  for (const botao of document.querySelectorAll("[data-install]")) botao.hidden = !deveMostrar();
}

/** Liga os botoes [data-install] da pagina e registra o service worker. Chame depois de montar a navegacao. */
export function initPwa() {
  for (const botao of document.querySelectorAll("[data-install]")) {
    if (botao.dataset.pronto) continue;
    botao.dataset.pronto = "1";
    botao.addEventListener("click", instalar);
  }
  atualizarBotoes();

  const seguro = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if ("serviceWorker" in navigator && seguro) {
    navigator.serviceWorker.register("service-worker.js").catch(() => { /* sem service worker o site funciona igual */ });
  }
}
