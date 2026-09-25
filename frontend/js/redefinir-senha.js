import { api, clearSession, el, renderNav, showMessage, $ } from "./app.js";

renderNav();

// O token vem no fragmento (#token=...): o navegador nao o envia a nenhum servidor. Guarda em memoria e tira da barra
// de enderecos e do historico logo na abertura.
const token = new URLSearchParams(location.hash.slice(1)).get("token") || "";
if (location.hash) history.replaceState(null, "", location.pathname + location.search);

function pedirNovoLink(texto) {
  return el("a", { href: "esqueci-senha.html" }, texto);
}

if (!token) {
  $("#campos").hidden = true;
  showMessage($("#msg"), "Este link está incompleto. Abra o link do e-mail de novo ou peça um novo.");
  $("#rodape").replaceChildren(pedirNovoLink("Pedir um novo link"), " · ", el("a", { href: "login.html" }, "Voltar para o login"));
}

$("#form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!token) return;
  const password = $("#password").value;
  if (password.length < 8) return showMessage($("#msg"), "A senha precisa ter pelo menos 8 caracteres.");
  if (password !== $("#confirm").value) return showMessage($("#msg"), "As senhas não são iguais.");

  const button = $("#submit");
  button.disabled = true;
  showMessage($("#msg"), "");
  try {
    const data = await api("/auth/reset-password", { method: "POST", body: { token, password } });
    clearSession(); // as sessoes abertas caem no servidor; aqui tambem
    $("#campos").hidden = true;
    showMessage($("#msg"), data.mensagem, "ok");
    $("#rodape").replaceChildren(el("a", { class: "btn small", href: "login.html" }, "Entrar"));
  } catch (error) {
    showMessage($("#msg"), error.message);
    button.disabled = false;
    // Link vencido, ja usado (400) ou cortado (422 "Link invalido"): nao adianta tentar de novo com o mesmo token.
    if (error.status === 400 || /link/i.test(error.message)) {
      $("#campos").hidden = true;
      $("#rodape").replaceChildren(pedirNovoLink("Pedir um novo link"), " · ", el("a", { href: "login.html" }, "Voltar para o login"));
    }
  }
});
