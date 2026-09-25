import { api, getToken, params, renderNav, safeNext, setSession, showMessage, $ } from "./app.js";

renderNav();
const next = safeNext(params().get("next"));
if (getToken()) location.replace(next);

$("#form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("#submit");
  button.disabled = true;
  showMessage($("#msg"), "");
  try {
    const data = await api("/auth/login", {
      method: "POST",
      body: { email: $("#email").value.trim(), password: $("#password").value },
    });
    setSession(data.access_token, data.user);
    location.href = next;
  } catch (error) {
    showMessage($("#msg"), error.message);
    button.disabled = false;
  }
});
