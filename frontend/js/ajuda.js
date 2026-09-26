import { renderNav } from "./app.js";
import { reiniciarTutorial } from "./tutorial.js";

renderNav(); // monta o menu e troca os marcadores data-icone pelos ícones

// Abre o assunto pedido na URL (ajuda.html#faq).
const alvo = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
if (alvo) alvo.scrollIntoView();

// "Ver o tutorial de boas-vindas" também apaga o progresso, para os tours de cada página voltarem a aparecer sozinhos.
document.querySelector('[data-tutorial="boas-vindas"]')?.addEventListener("click", reiniciarTutorial);
