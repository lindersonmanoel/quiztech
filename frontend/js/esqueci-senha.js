import { api, renderNav, showMessage, $ } from "./app.js";

renderNav();

const RECARREGA_APOS_MS = 30000; // evita cliques repetidos: cada pedido dispara um e-mail

// Se o servidor ainda nao tem e-mail configurado, avisa em vez de prometer um envio que nao vai acontecer.
api("/config").then((cfg) => {
  if (cfg.password_reset) return;
  $("#submit").disabled = true;
  $("#email").disabled = true;
  showMessage($("#msg"), "A recuperação de senha por e-mail ainda não está ativada neste servidor. Fale com o administrador do sistema.");
}).catch(() => { /* sem resposta: deixa o formulario funcionar e o envio mostra o erro */ });

$("#form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("#submit");
  const email = $("#email").value.trim();
  if (!email) return showMessage($("#msg"), "Informe o e-mail da sua conta.");
  button.disabled = true;
  showMessage($("#msg"), "");
  try {
    const data = await api("/auth/forgot-password", { method: "POST", body: { email } });
    // A resposta e' a mesma exista a conta ou nao (a API nao revela quais e-mails tem cadastro).
    showMessage($("#msg"), data.mensagem, "ok");
    button.textContent = "Link enviado";
    setTimeout(() => { button.disabled = false; button.textContent = "Enviar de novo"; }, RECARREGA_APOS_MS);
  } catch (error) {
    showMessage($("#msg"), error.message);
    button.disabled = false;
  }
});
