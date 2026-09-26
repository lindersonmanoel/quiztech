// Cartão "Novidades": mostra a versão atual e o que mudou nas últimas atualizações (lidas de versao.js, a mesma fonte do
// aviso de atualização). Usado em Meu perfil e na Central de Ajuda.

import { APP_VERSION, CHANGELOG } from "./versao.js";
import { el } from "./app.js";

const dataBR = (iso) => {
  const [ano, mes, dia] = String(iso || "").split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : "";
};

/** Preenche `lista` com as últimas `limite` versões e `rotuloVersao` com o número da versão em uso. Pode ser chamada de novo sem duplicar. */
export function renderizarNovidades(lista, rotuloVersao, limite = 4) {
  if (!lista) return;
  if (rotuloVersao) rotuloVersao.textContent = `v${APP_VERSION}`;
  lista.replaceChildren(...CHANGELOG.slice(0, limite).map((item) => el("div", { class: "novidade-item" },
    el("strong", {}, `Versão ${item.versao}`),
    el("span", { class: "muted" }, item.data ? ` (${dataBR(item.data)})` : ""),
    el("ul", {}, item.mudancas.map((texto) => el("li", {}, texto))))));
}
