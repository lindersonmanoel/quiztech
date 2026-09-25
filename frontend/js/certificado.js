import { api, apiText, DIFFICULTY, el, fmtDate, params, renderNav, showMessage, $ } from "./app.js";

renderNav();

/** QR Code (SVG gerado pela API) como imagem embutida: o site nao precisa liberar mais nenhuma origem de imagem. */
async function qrDoCertificado(code) {
  const svg = await apiText(`/certificates/${encodeURIComponent(code)}/qr.svg`);
  if (!svg || !svg.includes("<svg")) return null;
  return el("figure", { class: "cert-qr" },
    el("img", {
      src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, width: 132, height: 132,
      alt: "QR Code que abre a página de verificação deste certificado",
    }),
    el("figcaption", {}, "Aponte a câmera para conferir a autenticidade"));
}

async function load() {
  const code = (params().get("code") || "").trim();
  if (!code) return showMessage($("#msg"), "Informe o código do certificado na URL (?code=QT-XXXX).");
  try {
    const c = await api(`/certificates/${encodeURIComponent(code)}`);
    const verifyUrl = `${location.origin}${location.pathname}?code=${encodeURIComponent(c.code)}`;
    const nivel = DIFFICULTY[c.difficulty];
    // O titulo dos quizzes do catalogo ja termina com o nivel; nos criados pelo painel, o nivel e' acrescentado aqui.
    const nivelNoTitulo = nivel && c.quiz_title.toLowerCase().includes(nivel.toLowerCase());
    document.title = `Certificado — ${c.user_name} — QUIZ TECH`;
    const qr = await qrDoCertificado(c.code);
    $("#cert").replaceChildren(el("article", { class: "certificate", "aria-label": "Certificado de conclusão" },
      el("img", { class: "logo", src: "assets/logo/logo.png", alt: "QUIZ TECH" }),
      el("h1", {}, "CERTIFICADO"),
      el("p", {}, "de conclusão"),
      el("p", { class: "text" }, "Certificamos que"),
      el("div", { class: "name" }, c.user_name),
      el("p", { class: "text" },
        `concluiu com aproveitamento de ${c.percentage}% (${c.score} pontos) o quiz `, el("strong", {}, c.quiz_title),
        nivel && !nivelNoTitulo ? `, nível ${nivel}` : "",
        `, da área de ${c.category_name}, na plataforma QUIZ TECH, em ${fmtDate(c.issued_at)}.`),
      qr,
      el("p", { class: "code" }, `Código de verificação: ${c.code}`, el("br"), `Autenticidade: ${verifyUrl}`)));
    $("#actions").hidden = false;
    $("#print").addEventListener("click", () => window.print());
  } catch (error) {
    showMessage($("#msg"), error.status === 404 ? "Certificado não encontrado. Confira o código." : error.message);
  }
}

load();
