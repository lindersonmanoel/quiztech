// Adapta o site ao aparelho: celular, tablet, computador ou TV.
//  - Marca <html data-dispositivo="celular|tablet|computador|tv"> para o CSS (tamanho de letra, alvos de toque, foco).
//  - Na TV (e quando a pessoa força com ?tv=1), as setas do controle remoto movem o foco entre botões e links, Enter aciona
//    e o botão Voltar do controle volta à página anterior.
// Para testar no computador: abra qualquer página com ?tv=1 (liga o modo TV) ou ?tv=0 (desliga). A escolha fica lembrada.

const CHAVE = "quiztech_dispositivo";

function guardado() { try { return localStorage.getItem(CHAVE); } catch { return null; } }
function guardar(valor) { try { if (valor) localStorage.setItem(CHAVE, valor); else localStorage.removeItem(CHAVE); } catch { /* ignore */ } }

/** Descobre o tipo de aparelho pelo navegador e pelo toque (função pura: recebe os dados para poder ser testada). */
export function detectarDispositivo({ ua = "", toques = 0, largura = 1280, forcado = "" } = {}) {
  if (forcado === "tv") return "tv";
  if (/SmartTV|SMART-TV|HbbTV|Tizen|Web0S|WebOS|NetCast|AppleTV|Android TV|AndroidTV|GoogleTV|BRAVIA|AFT[A-Z]|CrKey|Roku|VIDAA|Philips|Hisense|Viera|Opera TV|TV Safari/i.test(ua)) return "tv";
  if (/iPad|Tablet|PlayBook|Silk|Kindle|SM-T|Nexus 7|Nexus 9/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return "tablet";
  if (/Macintosh/i.test(ua) && toques > 1) return "tablet"; // iPad no modo "site para computador"
  if (/Mobi|iPhone|iPod|Android/i.test(ua)) return "celular";
  if (toques > 0 && largura < 1100) return "tablet";
  return "computador";
}

function tipoAtual() {
  const q = new URLSearchParams(location.search).get("tv");
  if (q === "1") guardar("tv");
  else if (q === "0") guardar(null);
  return detectarDispositivo({ ua: navigator.userAgent, toques: navigator.maxTouchPoints || 0, largura: window.innerWidth, forcado: guardado() === "tv" ? "tv" : "" });
}

export const dispositivo = tipoAtual();
document.documentElement.dataset.dispositivo = dispositivo;

// ---------- Navegação por setas (TV / controle remoto) ----------

const FOCAVEIS = "a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex='-1'])";

function visivel(no) {
  if (no.closest("[hidden], [inert]")) return false;
  const r = no.getBoundingClientRect();
  if (!r.width || !r.height) return false;
  const estilo = getComputedStyle(no);
  return estilo.visibility !== "hidden" && estilo.display !== "none";
}

/** Escolhe o próximo elemento na direção da seta: o mais próximo na direção, com preferência por quem está alinhado. */
export function proximoNaDirecao(atual, candidatos, direcao) {
  const centro = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  const de = atual.getBoundingClientRect();
  const c0 = centro(de);
  let melhor = null;
  let melhorNota = Infinity;
  for (const no of candidatos) {
    if (no === atual) continue;
    const r = no.getBoundingClientRect();
    const c = centro(r);
    const dx = c.x - c0.x;
    const dy = c.y - c0.y;
    let principal;
    let lateral;
    if (direcao === "ArrowRight") { if (r.left < de.right - 2 && dx <= 0) continue; principal = r.left - de.right; lateral = Math.abs(dy); }
    else if (direcao === "ArrowLeft") { if (r.right > de.left + 2 && dx >= 0) continue; principal = de.left - r.right; lateral = Math.abs(dy); }
    else if (direcao === "ArrowDown") { if (r.top < de.bottom - 2 && dy <= 0) continue; principal = r.top - de.bottom; lateral = Math.abs(dx); }
    else { if (r.bottom > de.top + 2 && dy >= 0) continue; principal = de.top - r.bottom; lateral = Math.abs(dx); }
    const nota = Math.max(0, principal) + lateral * 2.2;
    if (nota < melhorNota) { melhorNota = nota; melhor = no; }
  }
  return melhor;
}

function ativarSetas() {
  document.addEventListener("keydown", (evento) => {
    if (evento.defaultPrevented || evento.altKey || evento.ctrlKey || evento.metaKey) return;
    // Botão Voltar dos controles: Tizen (Samsung) 10009, webOS (LG) 461, Android TV/Fire TV "GoBack"/"BrowserBack".
    if (evento.keyCode === 10009 || evento.keyCode === 461 || evento.key === "GoBack" || evento.key === "BrowserBack" || evento.key === "XF86Back") {
      evento.preventDefault();
      if (history.length > 1) history.back();
      return;
    }
    if (!/^Arrow(Up|Down|Left|Right)$/.test(evento.key)) return;
    const foco = document.activeElement;
    const tag = foco && foco.tagName;
    if (tag === "SELECT" || tag === "TEXTAREA") return;
    if (tag === "INPUT" && /^(text|search|email|password|url|tel|number)$/i.test(foco.type) && /Left|Right/.test(evento.key)) return; // cursor do texto
    const dialogo = document.querySelector("dialog[open], .tour-root");
    const raiz = dialogo || document;
    const candidatos = [...raiz.querySelectorAll(FOCAVEIS)].filter(visivel);
    if (!candidatos.length) return;
    evento.preventDefault();
    if (!foco || foco === document.body || !candidatos.includes(foco)) {
      candidatos[0].focus();
      return;
    }
    const proximo = proximoNaDirecao(foco, candidatos, evento.key);
    if (proximo) {
      proximo.focus();
      proximo.scrollIntoView({ block: "nearest", inline: "nearest" });
    } else if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      window.scrollBy({ top: evento.key === "ArrowDown" ? 240 : -240 });
    }
  });
}

if (dispositivo === "tv") ativarSetas();
