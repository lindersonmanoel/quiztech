import { api, el, fmtDate, params, renderNav, showMessage, $ } from "./app.js";

renderNav();

async function load() {
  const code = (params().get("code") || "").trim();
  if (!code) return showMessage($("#msg"), "Informe o código do certificado na URL (?code=QT-XXXX).");
  try {
    const c = await api(`/certificates/${encodeURIComponent(code)}`);
    const verifyUrl = `${location.origin}${location.pathname}?code=${encodeURIComponent(c.code)}`;
    document.title = `Certificado — ${c.user_name} — QUIZ TECH`;
    $("#cert").replaceChildren(el("article", { class: "certificate", "aria-label": "Certificado de conclusão" },
      el("img", { class: "logo", src: "assets/logo/logo.png", alt: "QUIZ TECH" }),
      el("h1", {}, "CERTIFICADO"),
      el("p", {}, "de conclusão"),
      el("p", { class: "text" }, "Certificamos que"),
      el("div", { class: "name" }, c.user_name),
      el("p", { class: "text" },
        `concluiu com aproveitamento de ${c.percentage}% (${c.score} pontos) o quiz `, el("strong", {}, c.quiz_title),
        `, da área de ${c.category_name}, na plataforma QUIZ TECH, em ${fmtDate(c.issued_at)}.`),
      el("p", { class: "code" }, `Código de verificação: ${c.code}`, el("br"), `Autenticidade: ${verifyUrl}`)));
    $("#actions").hidden = false;
    $("#print").addEventListener("click", () => window.print());
  } catch (error) {
    showMessage($("#msg"), error.status === 404 ? "Certificado não encontrado. Confira o código." : error.message);
  }
}

load();
