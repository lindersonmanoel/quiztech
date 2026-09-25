"use strict";

// Endereco da API (termina em /api). Em producao o site fica no Vercel e a API no servidor proprio (VM com
// Cloudflare Tunnel), entao os enderecos sao diferentes e o navegador faz chamadas CORS.
//   - Local: a API do backend-node em localhost:3100 (ou a mesma origem, se ela mesma serve o site).
//   - Demonstracao (tunel trycloudflare): a propria API serve o site, entao e' a mesma origem.
//   - Producao: o dominio publico da API. TROQUE pelo seu quando o tunel e o DNS estiverem prontos.
(function () {
  const API_PRODUCAO = "https://api.quiztech.lumvix.com.br/api";
  const host = location.hostname;
  let base;
  if (host === "localhost" || host === "127.0.0.1") {
    base = location.port === "3100" ? "/api" : "http://localhost:3100/api";
  } else if (host.endsWith(".trycloudflare.com")) {
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
