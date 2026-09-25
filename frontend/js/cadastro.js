import { api, getToken, params, renderNav, safeNext, setSession, showMessage, $ } from "./app.js";

renderNav();
const next = safeNext(params().get("next"));
if (getToken()) location.replace(next);

$("#form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("#submit");
  const password = $("#password").value;
  if (!$("#terms").checked) return showMessage($("#msg"), "Para se cadastrar, aceite a Política de Privacidade.");
  if (password.length < 8) return showMessage($("#msg"), "A senha precisa ter pelo menos 8 caracteres.");
  button.disabled = true;
  showMessage($("#msg"), "");
  try {
    const data = await api("/auth/register", {
      method: "POST",
      body: { name: $("#name").value, email: $("#email").value.trim(), password },
    });
    setSession(data.access_token, data.user);
    location.href = next;
  } catch (error) {
    showMessage($("#msg"), error.message);
    button.disabled = false;
  }
});
