import { api, el, fmtDate, getUser, renderNav, requireLogin, setSession, getToken, showMessage, $ } from "./app.js";

renderNav();

function renderProfile(user) {
  const input = el("input", { id: "name", type: "text", value: user.name, minlength: "2", maxlength: "80", required: true });
  $("#profile").replaceChildren(
    el("form", {
      novalidate: true,
      onsubmit: async (event) => {
        event.preventDefault();
        try {
          const updated = await api("/users/me", { method: "PUT", body: { name: input.value } });
          setSession(getToken(), updated);
          showMessage($("#msg"), "Nome atualizado. Certificados novos usarão este nome.", "ok");
        } catch (error) {
          showMessage($("#msg"), error.message);
        }
      },
    },
    el("p", { class: "muted" }, user.email),
    el("div", { class: "field" }, el("label", { for: "name" }, "Nome (aparece no certificado)"), input),
    el("button", { class: "btn small", type: "submit" }, "Salvar nome")));
}

async function load() {
  if (!requireLogin()) return;
  try {
    const [user, certs, results] = await Promise.all([api("/users/me"), api("/certificates"), api("/results")]);
    renderProfile(user);

    $("#certs").replaceChildren(...(certs.length
      ? certs.map((c) => el("article", { class: "card" },
        el("h3", {}, c.category_name),
        el("p", { class: "muted" }, `${c.percentage}% · emitido em ${fmtDate(c.issued_at)}`),
        el("a", { class: "btn small", href: `certificado.html?code=${encodeURIComponent(c.code)}` }, "Abrir certificado")))
      : [el("p", { class: "muted" }, "Você ainda não tem certificados. Acerte 70% ou mais em um quiz para receber o primeiro.")]));

    $("#history").replaceChildren(...(results.length
      ? results.map((r) => el("tr", {},
        el("td", {}, r.quiz_title),
        el("td", {}, `${r.score}/${r.max_score}`),
        el("td", {}, `${r.percentage}%`),
        el("td", {}, r.passed ? "Aprovado" : "Não aprovado"),
        el("td", {}, el("a", { href: `resultado.html?id=${r.id}` }, "Detalhes"))))
      : [el("tr", {}, el("td", { colspan: "5", class: "muted" }, "Nenhum quiz respondido ainda."))]));
  } catch (error) {
    showMessage($("#msg"), error.message);
  }
}

// Mostra o nome salvo enquanto a API responde.
const cached = getUser();
if (cached) renderProfile(cached);
load();
