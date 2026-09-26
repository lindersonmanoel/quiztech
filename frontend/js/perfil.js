import { renderizarNovidades } from "./novidades.js";
import { api, clearSession, DIFFICULTY, el, fmtDate, getUser, renderNav, requireLogin, setSession, getToken, showMessage, tituloQuiz, $ } from "./app.js";

renderNav();
renderizarNovidades(document.getElementById("lista-novidades"), document.getElementById("versao-atual"));

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
          showMessage($("#msg"), "Nome atualizado. Os novos certificados utilizarão este nome.", "ok");
        } catch (error) {
          showMessage($("#msg"), error.message);
        }
      },
    },
    el("p", { class: "muted" }, user.email),
    el("div", { class: "field" }, el("label", { for: "name" }, "Nome (exibido no certificado)"), input),
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
        el("p", {}, el("span", { class: `badge nivel-${c.difficulty}` }, DIFFICULTY[c.difficulty] || "")),
        el("p", { class: "muted" }, `${c.percentage}% · emitido em ${fmtDate(c.issued_at)}`),
        el("a", { class: "btn small", href: `certificado.html?code=${encodeURIComponent(c.code)}` }, "Abrir certificado")))
      : [el("p", { class: "muted" }, "Você ainda não possui certificados. Alcance 70% de acertos ou mais em um quiz para receber o primeiro.")]));

    $("#history").replaceChildren(...(results.length
      ? results.map((r) => el("tr", {},
        el("td", {}, tituloQuiz(r.quiz_title)),
        el("td", {}, `${r.score}/${r.max_score}`),
        el("td", {}, `${r.percentage}%`),
        el("td", {}, r.passed ? "Aprovado" : "Não aprovado"),
        el("td", {}, el("a", { href: `resultado.html?id=${r.id}` }, "Detalhes"))))
      : [el("tr", {}, el("td", { colspan: "5", class: "muted" }, "Nenhum quiz foi respondido até o momento."))]));
  } catch (error) {
    showMessage($("#msg"), error.message);
  }
}

$("#delete-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = $("#delete-password").value;
  if (!password) return showMessage($("#msg"), "Informe a sua senha para confirmar.");
  if (!confirm("Deseja realmente excluir a conta? A conta, os resultados e os certificados serão removidos definitivamente.")) return;
  try {
    await api("/users/me/delete", { method: "POST", body: { password } });
    clearSession();
    location.href = "index.html";
  } catch (error) {
    showMessage($("#msg"), error.message);
  }
});

// Mostra o nome salvo enquanto a API responde.
const cached = getUser();
if (cached) renderProfile(cached);
load();
