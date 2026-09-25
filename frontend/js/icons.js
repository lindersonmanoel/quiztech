// Ícones do site em SVG (desenhados para o QUIZ TECH). Todos usam a cor do texto ao redor (currentColor),
// então mudam de cor com o CSS e ficam nítidos em qualquer tamanho e aparelho, sem depender de emojis do sistema.
//
// Cada ícone é uma lista de formas num quadro de 24x24: ["path", {...}], ["rect", {...}], ["circle", {...}]...
// Formas com preenchimento (pontos, olhos) trazem fill: "currentColor". O resto é contorno (stroke).

const P = (d) => ["path", { d }];
const R = (x, y, width, height, rx = 0) => ["rect", { x, y, width, height, rx }];
const C = (cx, cy, r) => ["circle", { cx, cy, r }];
const PONTO = (cx, cy, r = 1.2) => ["circle", { cx, cy, r, fill: "currentColor", stroke: "none" }];

// Liga dois círculos de raio r pelas bordas (para o desenho de rede neural).
function ligacao(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const tam = Math.hypot(dx, dy);
  const ux = (dx / tam) * r;
  const uy = (dy / tam) * r;
  return P(`M${(x1 + ux).toFixed(2)} ${(y1 + uy).toFixed(2)}L${(x2 - ux).toFixed(2)} ${(y2 - uy).toFixed(2)}`);
}

const NEURAL = (() => {
  const esquerda = [[4, 5], [4, 12], [4, 19]];
  const meio = [[12, 8.5], [12, 15.5]];
  const direita = [[20, 12]];
  const formas = [];
  for (const a of esquerda) for (const b of meio) formas.push(ligacao(a[0], a[1], b[0], b[1], 1.8));
  for (const a of meio) for (const b of direita) formas.push(ligacao(a[0], a[1], b[0], b[1], 1.8));
  for (const [x, y] of [...esquerda, ...meio, ...direita]) formas.push(C(x, y, 1.8));
  return formas;
})();

export const ICONES = {
  // ---------- Áreas do site (uma por área de tecnologia) ----------
  "flow": [R(9, 3, 6, 5, 1), P("M12 8v4"), P("M5.5 16v-4h13v4"), R(2.5, 16, 6, 5, 1), R(15.5, 16, 6, 5, 1)],
  "python": [P("M14 3.5H8A3.5 3.5 0 0 0 4.5 7v3.5A2 2 0 0 0 6.5 12.5H13a2 2 0 0 1 2 2V17"), P("M10 20.5h6a3.5 3.5 0 0 0 3.5-3.5v-3.5a2 2 0 0 0-2-2H11a2 2 0 0 1-2-2V7"), PONTO(7.6, 6.6, 1), PONTO(16.4, 17.4, 1)],
  "braces": [P("M8 3H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1"), P("M16 3h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1")],
  "cup": [P("M4 8h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"), P("M16 9h1.5a2.5 2.5 0 0 1 0 5H16"), P("M7 3v2"), P("M10.5 3v2"), P("M3 21h14")],
  "pointer": [R(2.5, 7, 10, 10, 1.5), P("M12.5 12h8"), P("M17.5 8.5L21 12l-3.5 3.5")],
  "hex-hash": [P("M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z"), P("M10 9.5l-.7 5"), P("M14.7 9.5l-.7 5"), P("M8.3 11.2h7.6"), P("M8 13.4h7.6")],
  "browser": [R(3, 4, 18, 16, 2), P("M3 9h18"), PONTO(6, 6.5, 0.7), P("M10 12.5l-2.5 2.2 2.5 2.2"), P("M14 12.5l2.5 2.2-2.5 2.2")],
  "server": [R(3, 3, 18, 7, 2), R(3, 14, 18, 7, 2), PONTO(7, 6.5, 0.9), PONTO(7, 17.5, 0.9), P("M11 6.5h6"), P("M11 17.5h6"), P("M12 10v4")],
  "phone": [R(6.5, 2.5, 11, 19, 2.5), P("M10.5 18.5h3"), P("M10.5 5.5h3")],
  "branch": [C(6, 5.5, 2.5), C(6, 18.5, 2.5), C(18, 8.5, 2.5), P("M6 8v8"), P("M18 11c0 4.5-4 4.5-9 6")],
  "tree": [C(12, 5, 2.5), C(6, 19, 2.5), C(18, 19, 2.5), P("M12 7.5V11"), P("M6 16.5V11h12v5.5")],
  "checklist": [R(5, 4, 14, 17, 2), R(9, 2, 6, 4, 1), P("M8.5 12l2 2 3.5-4"), P("M8.5 17.5h7")],
  "gamepad": [P("M6.5 7.5h11a4.5 4.5 0 0 1 4.4 5.5l-.8 3.6a2.6 2.6 0 0 1-4.4 1.2L15 15.5H9l-1.7 2.3a2.6 2.6 0 0 1-4.4-1.2L2.1 13A4.5 4.5 0 0 1 6.5 7.5z"), P("M7.5 10.5v4"), P("M5.5 12.5h4"), PONTO(15.5, 11.5, 0.9), PONTO(18, 13.5, 0.9)],
  "database": [["ellipse", { cx: 12, cy: 5.5, rx: 8, ry: 3 }], P("M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13"), P("M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3")],
  "chart": [P("M3 3v18h18"), P("M8 17v-5"), P("M13 17V8"), P("M18 17V9")],
  "robot": [R(4.5, 8, 15, 11, 3.5), P("M12 4.8V8"), C(12, 3.7, 1.1), PONTO(9, 13, 1.1), PONTO(15, 13, 1.1), P("M9.5 16.5h5"), P("M2.5 12v3"), P("M21.5 12v3")],
  "neural": NEURAL,
  "globe": [C(12, 12, 9.5), P("M2.5 12h19"), P("M12 2.5c2.6 2.7 4 6 4 9.5s-1.4 6.8-4 9.5c-2.6-2.7-4-6-4-9.5s1.4-6.8 4-9.5z")],
  "terminal": [R(2.5, 4, 19, 16, 2.5), P("M7 9.5l3 2.5-3 2.5"), P("M12.5 15H17")],
  "cloud": [P("M7.5 19a4.5 4.5 0 0 1-.8-8.93A6 6 0 0 1 18.2 9.6 4.7 4.7 0 0 1 17 19z")],
  "container": [P("M12 2.5l8.5 4.8v9.4L12 21.5l-8.5-4.8V7.3z"), P("M12 12l8.5-4.7"), P("M12 12L3.5 7.3"), P("M12 12v9.5")],
  "chip": [R(6, 6, 12, 12, 2), R(9.5, 9.5, 5, 5, 0.5), P("M9 2.5V6"), P("M15 2.5V6"), P("M9 18v3.5"), P("M15 18v3.5"), P("M2.5 9H6"), P("M2.5 15H6"), P("M18 9h3.5"), P("M18 15h3.5")],
  "wifi": [P("M2.5 9.5a14 14 0 0 1 19 0"), P("M5.7 13a9.5 9.5 0 0 1 12.6 0"), P("M9 16.4a5 5 0 0 1 6 0"), PONTO(12, 19.6, 1.1)],
  "shield": [P("M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"), P("M9 12l2 2 4-4")],
  "lock": [R(4.5, 10.5, 15, 10.5, 2.5), P("M8 10.5v-3a4 4 0 0 1 8 0v3"), PONTO(12, 15.2, 1.3), P("M12 16.4v2")],
  "layout": [R(3, 3, 18, 18, 2.5), P("M3 9h18"), P("M9.5 9v12")],
  "kanban": [R(3, 3, 18, 18, 2.5), P("M9 3v18"), P("M15 3v18"), P("M6 7v5"), P("M12 7v9"), P("M18 7v3")],
  "scale": [P("M12 3.5v17"), P("M7.5 20.5h9"), P("M5 6.5h14"), P("M5 6.5l-2.8 6.7a3.4 3.4 0 0 0 5.6 0z"), P("M19 6.5l2.8 6.7a3.4 3.4 0 0 1-5.6 0z")],
  "rocket": [P("M12 2.5c3.2 2.4 4.8 5.6 4.8 9.3l-1.6 3.4H8.8l-1.6-3.4C7.2 8.1 8.8 4.9 12 2.5z"), C(12, 9.5, 1.6), P("M8.8 15.2l-2.8 2.6 2.8.4"), P("M15.2 15.2l2.8 2.6-2.8.4"), P("M12 16.5v4.5")],
  "monitor": [R(3, 4, 18, 12, 2), P("M8.5 20h7"), P("M12 16v4")],
  "math": [P("M6.5 3.5v6"), P("M3.5 6.5h6"), P("M14.5 6.5h6"), P("M4 15l5 5"), P("M9 15l-5 5"), P("M14.5 17.5h6"), PONTO(17.5, 14.6, 0.8), PONTO(17.5, 20.4, 0.8)],
  "atom": [PONTO(12, 12, 1.6), ["ellipse", { cx: 12, cy: 12, rx: 10, ry: 4 }], ["ellipse", { cx: 12, cy: 12, rx: 10, ry: 4, transform: "rotate(60 12 12)" }], ["ellipse", { cx: 12, cy: 12, rx: 10, ry: 4, transform: "rotate(120 12 12)" }]],
  "code": [P("M8 7l-5 5 5 5"), P("M16 7l5 5-5 5"), P("M14 4l-4 16")],

  // ---------- Interface ----------
  "download": [P("M12 3.5v11"), P("M7.5 10.5L12 15l4.5-4.5"), P("M4.5 19.5h15")],
  "check-circle": [C(12, 12, 9.5), P("M7.8 12.3l2.9 2.9 5.6-6")],
  "x-circle": [C(12, 12, 9.5), P("M9 9l6 6"), P("M15 9l-6 6")],
  "trophy": [P("M7.5 3.5h9v6a4.5 4.5 0 0 1-9 0z"), P("M7.5 5.5h-3a2.6 2.6 0 0 0 3 4.6"), P("M16.5 5.5h3a2.6 2.6 0 0 1-3 4.6"), P("M12 14v3.5"), P("M10 17.5h4"), P("M8.5 20.5h7")],
  "kebab": [PONTO(12, 5, 1.6), PONTO(12, 12, 1.6), PONTO(12, 19, 1.6)],
  "kebab-h": [PONTO(5, 12, 1.6), PONTO(12, 12, 1.6), PONTO(19, 12, 1.6)],
  "menu": [P("M4 6.5h16"), P("M4 12h16"), P("M4 17.5h16")],
};

export const ICONE_PADRAO = "code";

/** Nomes de todos os ícones desenhados (o painel do administrador usa para escolher o ícone de uma área). */
export const NOMES_DE_ICONES = Object.keys(ICONES);
const SVG_NS = "http://www.w3.org/2000/svg";

/** Cria o <svg> do ícone `nome` (se não existir, usa o ícone padrão). `tamanho` em px; a cor vem do texto (currentColor). */
export function icone(nome, { tamanho = 20, classe = "" } = {}) {
  const formas = ICONES[nome] || ICONES[ICONE_PADRAO];
  const svg = document.createElementNS(SVG_NS, "svg");
  const atributos = {
    viewBox: "0 0 24 24", width: tamanho, height: tamanho, fill: "none", stroke: "currentColor",
    "stroke-width": 1.8, "stroke-linecap": "round", "stroke-linejoin": "round",
    "aria-hidden": "true", focusable: "false", class: `icone${classe ? ` ${classe}` : ""}`,
  };
  for (const [chave, valor] of Object.entries(atributos)) svg.setAttribute(chave, String(valor));
  for (const [tag, attrs] of formas) {
    const no = document.createElementNS(SVG_NS, tag);
    for (const [chave, valor] of Object.entries(attrs)) no.setAttribute(chave, String(valor));
    svg.append(no);
  }
  return svg;
}

/** Troca cada marcador <span data-icone="nome" data-tamanho="18"> da página pelo SVG correspondente. */
export function montarIcones(raiz = document) {
  for (const marcador of raiz.querySelectorAll("[data-icone]")) {
    marcador.replaceChildren(icone(marcador.dataset.icone, { tamanho: Number(marcador.dataset.tamanho) || 18 }));
    marcador.removeAttribute("data-icone");
  }
}
