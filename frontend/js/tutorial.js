// Tutorial do QUIZ TECH: boas-vindas no primeiro acesso, tour guiado por página e botão de ajuda em todas as telas.
//  - Boas-vindas: 5 telas curtas explicando o site; aparece uma vez para cada pessoa logada (e pode ser refeito na Ajuda).
//  - Tour da página: destaca os elementos importantes com uma explicação; roda uma vez por página e pode ser repetido pelo botão "?".
//  - Funciona com toque, mouse, teclado (setas, Enter, Esc) e controle remoto de TV.
// O progresso fica só neste aparelho (localStorage); se o armazenamento estiver bloqueado, o tutorial simplesmente não lembra.

import { el, getUser, icone } from "./app.js";

const CHAVE = "quiztech_tutorial";
const PAGINAS_COM_BOAS_VINDAS = new Set(["index.html", "quizzes.html", "ranking.html", "perfil.html", "resultado.html"]);
const SEM_BOTAO_DE_AJUDA = new Set(["admin.html"]);

// ---------- Conteúdo ----------

const BOAS_VINDAS = [
  { icone: "rocket", titulo: "Bem-vindo ao QUIZ TECH",
    texto: "Nesta plataforma, você testa os seus conhecimentos em tecnologia e obtém certificados. Este guia rápido, com duração de cerca de um minuto, apresenta o funcionamento do site. É possível ignorá-lo e consultá-lo novamente a qualquer momento, pelo botão “?” exibido no canto da tela." },
  { icone: "list", titulo: "1. Escolha uma área e um nível",
    texto: "São 32 áreas, entre elas programação, dados, inteligência artificial, redes, segurança, design e gestão. Cada área possui 3 níveis (Fácil, Médio e Difícil), com 6 perguntas cada. Recomenda-se iniciar pelo nível Fácil e avançar gradualmente." },
  { icone: "clock", titulo: "2. Responda dentro do tempo",
    texto: "As perguntas são exibidas uma de cada vez. Há um tempo limite de 5 a 7 minutos e é possível voltar e alterar as respostas antes de finalizar. Quanto maior o nível de dificuldade, maior a pontuação de cada acerto." },
  { icone: "award", titulo: "3. Alcance 70% e obtenha o certificado",
    texto: "Com 70% ou mais de acertos, você recebe um certificado com o seu nome e um QR Code que comprova a autenticidade, podendo imprimi-lo ou salvá-lo em PDF. Em caso de reprovação, estude o conteúdo e tente novamente após alguns minutos." },
  { icone: "trophy", titulo: "4. Acompanhe o ranking",
    texto: "A sua pontuação compõe o ranking geral, mensal e semanal. Refazer um quiz não aumenta a pontuação de forma indevida: vale a melhor nota obtida em cada quiz." },
  { icone: "phone", titulo: "5. Utilize em qualquer aparelho",
    texto: "O QUIZ TECH funciona em celular, tablet, computador e TV. No celular, é possível instalá-lo como aplicativo. Em teclados e controles remotos, utilize as setas e a tecla Enter. Todas as orientações estão disponíveis na página Ajuda." },
];

// Cada passo aponta para um elemento da página ("alvo" = seletor CSS). Passos sem alvo aparecem centralizados.
const TOURS = {
  "index.html": {
    pronto: ".hero",
    passos: [
      { alvo: ".hero", titulo: "Página inicial", texto: "Esta é a página inicial do QUIZ TECH. A partir dela, você acessa os quizzes, o ranking e a Ajuda." },
      { alvo: ".actions .btn", titulo: "Ponto de partida", texto: "A opção “Ver quizzes” abre a lista de áreas. Cada área possui três níveis de dificuldade." },
      { alvo: "#como-funciona", titulo: "Como funciona", texto: "Resumo em quatro etapas: escolher, responder, certificar-se e acompanhar o ranking." },
      { alvo: "#areas", titulo: "Atalhos por área", texto: "Selecione uma área para visualizar apenas os quizzes correspondentes." },
      { alvo: ".nav-links", titulo: "Menu", texto: "No menu, estão os quizzes, o ranking, o seu perfil com os certificados e a Ajuda." },
    ],
  },
  "quizzes.html": {
    pronto: ".quiz-card, #list .msg",
    passos: [
      { alvo: "#search", titulo: "Busca", texto: "Digite um tema, como Python, Redes ou LGPD, para localizar rapidamente uma área." },
      { alvo: "#filters", titulo: "Grupos", texto: "Filtre por grupo de áreas, como Programação, Dados e Infraestrutura." },
      { alvo: "#levels", titulo: "Níveis", texto: "Exiba apenas os quizzes Fáceis, Médios ou Difíceis. O nível Fácil vale 10 pontos por pergunta e o Difícil, até 40." },
      { alvo: ".quiz-card", titulo: "Cartão da área", texto: "Cada área possui um cartão com os seus três níveis." },
      { alvo: ".level-row", titulo: "Escolha do nível", texto: "Selecione “Começar” para iniciar. O ícone verde indica que você já possui o certificado daquele nível." },
      { alvo: ".nav-links a[href=\"ranking.html\"]", titulo: "Ranking", texto: "Consulte quem obteve as maiores pontuações no geral, no mês e na semana." },
      { alvo: ".nav-links a[href=\"perfil.html\"]", titulo: "Meu perfil", texto: "Os seus certificados e o histórico de resultados ficam disponíveis nesta página." },
    ],
  },
  "quiz.html": {
    pronto: "#stage .card",
    passos: [
      { alvo: "#stage .card", titulo: "Antes de começar", texto: "Nesta tela constam o nível, o número de perguntas, a pontuação e o tempo limite. O cronômetro só é iniciado após a seleção de “Iniciar quiz”." },
      { alvo: "#stage .btn", titulo: "Iniciar", texto: "Após o início, responda uma pergunta por vez. Utilize “Anterior” e “Próxima” para navegar e “Finalizar” ao término. Se o tempo se esgotar, o quiz é enviado automaticamente." },
    ],
  },
  "resultado.html": {
    pronto: ".score .big",
    passos: [
      { alvo: ".score .big", titulo: "Seu resultado", texto: "Este é o seu percentual de acertos. Com 70% ou mais, você é aprovado." },
      { alvo: ".score .actions", titulo: "Próximos passos", texto: "É possível refazer o quiz, escolher outro ou consultar o ranking. Se houver aprovação, o botão do certificado é exibido acima." },
      { alvo: ".review", titulo: "Revisão", texto: "Confira cada pergunta, a resposta assinalada e a resposta correta. O gabarito completo é liberado após a aprovação." },
    ],
  },
  "ranking.html": {
    pronto: "#rows tr",
    passos: [
      { alvo: "#periods", titulo: "Período", texto: "Alterne entre o ranking geral, o mensal e o semanal. O semanal reinicia a cada segunda-feira e o mensal, no dia 1." },
      { alvo: ".toolbar", titulo: "Filtros", texto: "Filtre por área e por nível para comparar a pontuação em um assunto específico." },
      { alvo: ".table-wrap", titulo: "Tabela", texto: "Exibe a posição, o nome, a pontuação e a quantidade de quizzes de cada pessoa. Por privacidade, são mostrados apenas o primeiro nome e a inicial do sobrenome." },
    ],
  },
  "perfil.html": {
    pronto: "#profile form, #profile .msg",
    passos: [
      { alvo: "#profile", titulo: "Seus dados", texto: "Confira o seu e-mail e, se necessário, altere o nome. Ele é o nome impresso no certificado; os certificados novos utilizam o nome atualizado." },
      { alvo: "#certs", titulo: "Certificados", texto: "Relação de todos os certificados obtidos. Abra um deles para imprimir, salvar em PDF ou compartilhar." },
      { alvo: "#history", titulo: "Histórico", texto: "Todas as tentativas realizadas, com pontuação, acertos e situação de aprovação." },
      { alvo: "#novidades", titulo: "Novidades", texto: "Exibe a versão do QUIZ TECH em uso e as alterações das últimas atualizações. Quando houver uma nova versão, um aviso será exibido na tela, com um botão para atualizar." },
      { alvo: "#delete-form", titulo: "Exclusão da conta", texto: "Nesta seção, é possível excluir a conta e todos os dados associados (direito previsto na LGPD). A ação não pode ser desfeita." },
    ],
  },
  "certificado.html": {
    pronto: ".certificate",
    passos: [
      { alvo: ".certificate", titulo: "Seu certificado", texto: "O documento apresenta o nome, a área, o nível, a nota e a data de emissão." },
      { alvo: ".cert-qr", titulo: "QR Code", texto: "Ao ler o QR Code, qualquer pessoa acessa a página de verificação e confirma a autenticidade do certificado." },
      { alvo: "#print", titulo: "Imprimir ou salvar em PDF", texto: "Selecione esta opção e escolha “Salvar como PDF” no lugar da impressora para armazenar o arquivo." },
    ],
  },
};

const nomeDaPagina = () => location.pathname.split("/").pop() || "index.html";

// ---------- Progresso guardado no aparelho ----------

function lerEstado() {
  try { return JSON.parse(localStorage.getItem(CHAVE) || "{}") || {}; } catch { return {}; }
}
function gravarEstado(estado) {
  try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch { /* sem armazenamento: só não lembra */ }
}
const idDaPessoa = () => { const u = getUser(); return u ? `u${u.id}` : "visitante"; };
function estadoDaPessoa() { return lerEstado()[idDaPessoa()] || { boasVindas: false, desligado: false, paginas: {} }; }
function alterarEstado(fn) {
  const tudo = lerEstado();
  const atual = tudo[idDaPessoa()] || { boasVindas: false, desligado: false, paginas: {} };
  atual.paginas = atual.paginas || {};
  fn(atual);
  tudo[idDaPessoa()] = atual;
  gravarEstado(tudo);
}

// ---------- Utilidades ----------

let aberto = null; // { fechar } do tour/boas-vindas em exibição
let botaoAjuda = null;
let ajudaOculta = false; // o quiz esconde o botão enquanto o tempo corre

function esperarElemento(seletor, limiteMs = 5000) {
  return new Promise((resolve) => {
    const fim = Date.now() + limiteMs;
    (function tentar() {
      const no = document.querySelector(seletor);
      if (no && no.getClientRects().length) return resolve(no);
      if (Date.now() > fim) return resolve(null);
      setTimeout(tentar, 150);
    })();
  });
}

function prenderFoco(caixa, evento) {
  if (evento.key !== "Tab") return;
  const itens = [...caixa.querySelectorAll("button:not([disabled]), a[href]")];
  if (!itens.length) return;
  const primeiro = itens[0];
  const ultimo = itens[itens.length - 1];
  if (evento.shiftKey && document.activeElement === primeiro) { ultimo.focus(); evento.preventDefault(); }
  else if (!evento.shiftKey && document.activeElement === ultimo) { primeiro.focus(); evento.preventDefault(); }
}

function pontinhos(total, atual) {
  return el("div", { class: "tour-dots", "aria-hidden": "true" },
    Array.from({ length: total }, (_, i) => el("span", { class: i === atual ? "on" : (i < atual ? "done" : "") })));
}

// ---------- Boas-vindas (telas em sequência, sem destaque na página) ----------

export function mostrarBoasVindas({ aoTerminar } = {}) {
  fecharTudo();
  const anterior = document.activeElement;
  let indice = 0;
  const raiz = el("div", { class: "tour-root tour-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "tour-titulo", "aria-describedby": "tour-texto" });
  const nome = (getUser()?.name || "").split(" ")[0];

  function fechar(acao) {
    document.removeEventListener("keydown", teclas, true);
    raiz.remove();
    aberto = null;
    if (anterior && anterior.focus) anterior.focus();
    alterarEstado((e) => { e.boasVindas = true; if (acao === "pular") e.desligado = true; });
    if (aoTerminar) aoTerminar(acao);
  }

  function desenhar() {
    const passo = BOAS_VINDAS[indice];
    const ultimo = indice === BOAS_VINDAS.length - 1;
    const titulo = indice === 0 && nome ? `Seja bem-vindo(a), ${nome}` : passo.titulo;
    raiz.replaceChildren(el("div", { class: "tour-card tour-card-grande" },
      el("div", { class: "tour-icone", "aria-hidden": "true" }, icone(passo.icone, { tamanho: 44 })),
      el("p", { class: "tour-passo" }, `Tutorial · ${indice + 1} de ${BOAS_VINDAS.length}`),
      el("h2", { id: "tour-titulo" }, titulo),
      el("p", { id: "tour-texto" }, passo.texto),
      pontinhos(BOAS_VINDAS.length, indice),
      el("div", { class: "tour-acoes" },
        el("button", { type: "button", class: "btn secondary small", onclick: () => fechar("pular") }, "Ignorar tutorial"),
        indice > 0 ? el("button", { type: "button", class: "btn secondary", onclick: () => { indice--; desenhar(); } }, "Voltar") : null,
        ultimo
          ? [el("button", { type: "button", class: "btn secondary", onclick: () => fechar("concluir") }, "Começar a usar o site"),
             TOURS[nomeDaPagina()] ? el("button", { type: "button", class: "btn", "data-foco": "", onclick: () => fechar("tour") }, "Ver o tour desta página") : null]
          : el("button", { type: "button", class: "btn", "data-foco": "", onclick: () => { indice++; desenhar(); } }, "Próximo"))));
    (raiz.querySelector("[data-foco]") || raiz.querySelector("button")).focus();
  }

  function teclas(evento) {
    if (evento.key === "Escape") { evento.preventDefault(); fechar("pular"); }
    else if (evento.key === "ArrowRight" && indice < BOAS_VINDAS.length - 1) { evento.preventDefault(); indice++; desenhar(); }
    else if (evento.key === "ArrowLeft" && indice > 0) { evento.preventDefault(); indice--; desenhar(); }
    else prenderFoco(raiz, evento);
  }

  document.addEventListener("keydown", teclas, true);
  document.body.append(raiz);
  aberto = { fechar: () => fechar("fechar") };
  desenhar();
}

// ---------- Tour da página (destaca elementos) ----------

export async function iniciarTour(pagina = nomeDaPagina(), { automatico = false } = {}) {
  const tour = TOURS[pagina];
  if (!tour) return false;
  fecharTudo();
  if (!(await esperarElemento(tour.pronto, automatico ? 6000 : 3000))) return false;
  const passos = tour.passos.filter((p) => !p.alvo || document.querySelector(p.alvo));
  if (!passos.length) return false;

  const anterior = document.activeElement;
  let indice = 0;
  const destaque = el("div", { class: "tour-spot", "aria-hidden": "true" });
  const cartao = el("div", { class: "tour-card", role: "dialog", "aria-modal": "true", "aria-labelledby": "tour-titulo", "aria-describedby": "tour-texto" });
  const raiz = el("div", { class: "tour-root" }, destaque, cartao);
  let quadro = 0;

  function fechar() {
    document.removeEventListener("keydown", teclas, true);
    window.removeEventListener("resize", posicionarSoon);
    window.removeEventListener("scroll", posicionarSoon, true);
    cancelAnimationFrame(quadro);
    raiz.remove();
    aberto = null;
    if (anterior && anterior.focus) anterior.focus();
    alterarEstado((e) => { e.paginas[pagina] = true; });
  }

  function posicionar() {
    const passo = passos[indice];
    const alvo = passo.alvo ? document.querySelector(passo.alvo) : null;
    const margem = 12;
    const largura = window.innerWidth;
    const altura = window.innerHeight;
    if (!alvo) {
      destaque.style.cssText = "display:none";
      cartao.style.cssText = "left:50%;top:50%;transform:translate(-50%,-50%)";
      return;
    }
    const r = alvo.getBoundingClientRect();
    const pad = 8;
    destaque.style.cssText = `display:block;left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px`;
    const c = cartao.getBoundingClientRect();
    if (largura <= 640) { // celular: cartão fixo embaixo (ou no topo, se o alvo estiver embaixo)
      const alvoNaMetadeDeBaixo = r.top + r.height / 2 > altura / 2;
      cartao.style.cssText = alvoNaMetadeDeBaixo
        ? `left:${margem}px;right:${margem}px;top:${margem}px;width:auto;transform:none`
        : `left:${margem}px;right:${margem}px;bottom:${margem}px;top:auto;width:auto;transform:none`;
      return;
    }
    const cabeAbaixo = r.bottom + pad + margem + c.height <= altura;
    const cabeAcima = r.top - pad - margem - c.height >= 0;
    let topo;
    if (cabeAbaixo) topo = r.bottom + pad + margem;
    else if (cabeAcima) topo = r.top - pad - margem - c.height;
    else topo = Math.max(margem, altura - c.height - margem); // alvo grande: cartão fica na parte de baixo
    let esquerda = r.left + r.width / 2 - c.width / 2;
    esquerda = Math.min(Math.max(margem, esquerda), largura - c.width - margem);
    cartao.style.cssText = `left:${esquerda}px;top:${topo}px;transform:none`;
  }
  const posicionarSoon = () => { cancelAnimationFrame(quadro); quadro = requestAnimationFrame(posicionar); };

  function mostrarPasso() {
    const passo = passos[indice];
    const ultimo = indice === passos.length - 1;
    cartao.replaceChildren(
      el("p", { class: "tour-passo" }, `Passo ${indice + 1} de ${passos.length}`),
      el("h2", { id: "tour-titulo" }, passo.titulo),
      el("p", { id: "tour-texto" }, passo.texto),
      pontinhos(passos.length, indice),
      el("div", { class: "tour-acoes" },
        ultimo ? null : el("button", { type: "button", class: "btn secondary small", onclick: fechar }, "Ignorar"),
        indice > 0 ? el("button", { type: "button", class: "btn secondary small", onclick: () => { indice--; mostrarPasso(); } }, "Anterior") : null,
        el("button", { type: "button", class: "btn small", "data-foco": "", onclick: () => { if (ultimo) fechar(); else { indice++; mostrarPasso(); } } }, ultimo ? "Concluir" : "Próximo")));
    const alvo = passo.alvo ? document.querySelector(passo.alvo) : null;
    if (alvo) {
      // Sem animação: a posição do destaque é calculada logo em seguida e precisa do scroll já concluído.
      alvo.scrollIntoView({ block: window.innerWidth <= 640 ? "start" : "center", behavior: "instant" });
      if (window.innerWidth <= 640) window.scrollBy(0, -((document.querySelector(".nav")?.offsetHeight || 60) + 16)); // deixa o alvo abaixo do menu fixo
    }
    posicionar();
    cartao.querySelector("[data-foco]").focus({ preventScroll: true });
    posicionarSoon();
  }

  function teclas(evento) {
    if (evento.key === "Escape") { evento.preventDefault(); fechar(); }
    else if (evento.key === "ArrowRight") { evento.preventDefault(); if (indice < passos.length - 1) { indice++; mostrarPasso(); } else fechar(); }
    else if (evento.key === "ArrowLeft") { evento.preventDefault(); if (indice > 0) { indice--; mostrarPasso(); } }
    else prenderFoco(cartao, evento);
  }

  document.addEventListener("keydown", teclas, true);
  window.addEventListener("resize", posicionarSoon);
  window.addEventListener("scroll", posicionarSoon, true);
  document.body.append(raiz);
  aberto = { fechar };
  mostrarPasso();
  return true;
}

function fecharTudo() {
  if (aberto) aberto.fechar();
  document.getElementById("ajuda-menu")?.remove();
}

// ---------- Botão de ajuda ("?") ----------

function montarBotaoDeAjuda() {
  const pagina = nomeDaPagina();
  if (SEM_BOTAO_DE_AJUDA.has(pagina) || document.getElementById("ajuda-botao")) return;
  const temTour = Boolean(TOURS[pagina]);

  function fecharMenu() { document.getElementById("ajuda-menu")?.remove(); botaoAjuda.setAttribute("aria-expanded", "false"); }
  function abrirMenu() {
    const item = (rotulo, icone_, acao) => el("button", { type: "button", role: "menuitem", class: "ajuda-item", onclick: () => { fecharMenu(); acao(); } }, icone(icone_, { tamanho: 20 }), el("span", {}, rotulo));
    const menu = el("div", { id: "ajuda-menu", class: "ajuda-menu", role: "menu", "aria-label": "Ajuda" },
      temTour ? item("Tour desta página", "search", () => iniciarTour(pagina)) : null,
      item("Ver o tutorial de boas-vindas", "rocket", () => mostrarBoasVindas()),
      el("a", { class: "ajuda-item", role: "menuitem", href: "ajuda.html" }, icone("list", { tamanho: 20 }), el("span", {}, "Central de ajuda completa")));
    document.body.append(menu);
    botaoAjuda.setAttribute("aria-expanded", "true");
    menu.querySelector("button, a").focus();
    const fora = (e) => {
      if (!menu.isConnected) return document.removeEventListener("pointerdown", fora, true);
      if (!menu.contains(e.target) && e.target !== botaoAjuda && !botaoAjuda.contains(e.target)) { fecharMenu(); document.removeEventListener("pointerdown", fora, true); }
    };
    document.addEventListener("pointerdown", fora, true);
    menu.addEventListener("keydown", (e) => { if (e.key === "Escape") { fecharMenu(); botaoAjuda.focus(); } });
  }

  botaoAjuda = el("button", { id: "ajuda-botao", type: "button", class: "ajuda-fab", "aria-haspopup": "menu", "aria-expanded": "false", "aria-label": "Ajuda e tutorial" },
    icone("help", { tamanho: 26 }), el("span", { class: "ajuda-rotulo" }, "Ajuda"));
  botaoAjuda.addEventListener("click", () => (document.getElementById("ajuda-menu") ? fecharMenu() : abrirMenu()));
  botaoAjuda.hidden = ajudaOculta;
  document.body.append(botaoAjuda);
}

/** Esconde ou mostra o botão de ajuda (o quiz o esconde enquanto o tempo corre). */
export function ajudaVisivel(visivel) {
  ajudaOculta = !visivel;
  if (botaoAjuda) botaoAjuda.hidden = ajudaOculta;
  if (!visivel) fecharTudo();
}

// ---------- Início automático ----------

export function iniciarTutorial() {
  montarBotaoDeAjuda();
  const pagina = nomeDaPagina();
  const estado = estadoDaPessoa();
  if (!getUser() || estado.desligado) return;
  const depoisDasBoasVindas = (acao) => { if (acao === "tour") iniciarTour(pagina); };
  if (!estado.boasVindas && PAGINAS_COM_BOAS_VINDAS.has(pagina)) {
    setTimeout(() => mostrarBoasVindas({ aoTerminar: depoisDasBoasVindas }), 700);
  } else if (estado.boasVindas && TOURS[pagina] && !estado.paginas[pagina]) {
    setTimeout(() => iniciarTour(pagina, { automatico: true }), 900);
  }
}

/** Usado pela Central de ajuda: apaga o progresso para rever tudo desde o início. */
export function reiniciarTutorial() {
  alterarEstado((e) => { e.boasVindas = false; e.desligado = false; e.paginas = {}; });
}

// Permite abrir o tutorial por links como ajuda.html#tutorial ou botões com data-tutorial="boas-vindas|tour".
document.addEventListener("click", (evento) => {
  const gatilho = evento.target.closest?.("[data-tutorial]");
  if (!gatilho) return;
  evento.preventDefault();
  if (gatilho.dataset.tutorial === "boas-vindas") mostrarBoasVindas();
  else if (gatilho.dataset.tutorial === "tour") iniciarTour(gatilho.dataset.pagina || nomeDaPagina());
});
