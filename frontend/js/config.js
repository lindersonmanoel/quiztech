"use strict";

// Endereco da API (termina em /api). Em producao o site fica no Vercel e a API no servidor proprio (VM com
// Cloudflare Tunnel), entao os enderecos sao diferentes e o navegador faz chamadas CORS.
//   - Local: a API do backend-node em localhost:3100 (ou a mesma origem, se ela mesma serve o site).
//   - Demonstracao (tunel trycloudflare): a propria API serve o site, entao e' a mesma origem.
//   - Site no Vercel: a API publicada pelo Tailscale Funnel (endereco fixo e gratuito, sem dominio proprio).
//   - Aberto direto no endereco do Funnel (.ts.net): a propria API serve o site, entao e' a mesma origem.
(function () {
  const API_PRODUCAO = "https://quiztech.tailfdf602.ts.net/api";
  const host = location.hostname;
  let base;
  if (host === "localhost" || host === "127.0.0.1") {
    base = location.port === "3100" ? "/api" : "http://localhost:3100/api";
  } else if (host.endsWith(".trycloudflare.com") || host.endsWith(".ts.net")) {
    base = "/api";
  } else {
    base = API_PRODUCAO;
  }
  window.API_BASE_URL = base;

  // preconnect: abre a conexao com a API antes da primeira chamada (so' quando e' outra origem).
  try {
    const origem = new URL(base, location.href).origin;
    if (origem !== location.origin) {
      const link = document.createElement("link");
      link.rel = "preconnect";
      link.href = origem;
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
    }
  } catch (e) { /* sem preconnect o site funciona igual */ }
})();
