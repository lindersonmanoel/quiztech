"use strict";

// Service worker do QUIZ TECH: deixa o site instalavel (PWA) e abre a "casca" do app mesmo sem internet.
// Regras de seguranca: NUNCA intercepta a API (login, respostas, certificados) nem qualquer outra origem;
// so' arquivos estaticos do proprio site sao guardados.

const CACHE = "quiztech-shell-v2.4.3"; // acompanha APP_VERSION (js/versao.js); um teste confere
const ARQUIVOS = [
  "./", "index.html", "login.html", "cadastro.html", "quizzes.html", "quiz.html", "resultado.html", "ranking.html",
  "perfil.html", "certificado.html", "privacidade.html", "offline.html", "esqueci-senha.html", "redefinir-senha.html", "admin.html", "ajuda.html",
  "css/style.css",
  "js/config.js", "js/app.js", "js/pwa.js", "js/home.js", "js/login.js", "js/cadastro.js", "js/quizzes.js", "js/quiz.js",
  "js/resultado.js", "js/ranking.js", "js/perfil.js", "js/certificado.js", "js/privacidade.js", "js/offline.js", "js/icons.js",
  "js/esqueci-senha.js", "js/redefinir-senha.js", "js/admin.js", "js/ajuda.js", "js/tutorial.js", "js/dispositivo.js", "js/versao.js", "js/novidades.js",
  "assets/logo/logo.png", "assets/logo/favicon.png", "assets/fonts/orbitron-latin.woff2", "assets/bg-pattern.svg",
  "assets/icons/icon-192.png", "assets/logo/marca.svg", "assets/icons/code-abre.svg", "assets/icons/code-fecha.svg", "assets/icons/code-tag.svg",
  "manifest.webmanifest",
];
const ESPERA_REDE_MS = 4000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // Um arquivo que falhe nao pode impedir a instalacao inteira.
      Promise.allSettled(ARQUIVOS.map((url) => cache.add(new Request(url, { cache: "reload" }))))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

function comTempoLimite(promessa, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promessa.then((r) => { clearTimeout(t); resolve(r); }, (e) => { clearTimeout(t); reject(e); });
  });
}

// Rede primeiro (o site sempre atualizado quando ha internet); sem rede (ou muito lenta), usa o que foi guardado.
async function redePrimeiro(request) {
  const cache = await caches.open(CACHE);
  try {
    const resposta = await comTempoLimite(fetch(request), ESPERA_REDE_MS);
    if (resposta && resposta.ok && resposta.type === "basic") cache.put(request, resposta.clone());
    return resposta;
  } catch (erro) {
    const guardada = await cache.match(request, { ignoreSearch: true });
    if (guardada) return guardada;
    if (request.mode === "navigate") return (await cache.match("offline.html")) || Response.error();
    return Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // API em outro dominio, fontes externas etc.: nao mexe
  if (url.pathname.startsWith("/api/")) return; // API na mesma origem (modo demonstracao): nunca guarda
  if (url.pathname.endsWith("/service-worker.js")) return;
  event.respondWith(redePrimeiro(request));
});
