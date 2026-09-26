// Painel do administrador. Toda a seguranca esta no servidor (as rotas /admin exigem login E perfil de administrador);
// esta tela so' organiza o uso. Todo texto dinamico entra por textContent (el()), nunca por innerHTML.

import { api, DIFFICULTY, NIVEIS, el, fmtDate, getToken, getUser, icone, renderNav, requireLogin, setSession, showMessage, $ } from "./app.js";
import { NOMES_DE_ICONES } from "./icons.js";

renderNav();

const painel = $("#painel");
let categorias = [];
let euMesmo = null;
let contador = 0;

// ---------- utilitarios ----------
const novoId = (prefixo = "f") => `${prefixo}${++contador}`;
const dataHora = (iso) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

function aviso(texto, tipo = "error") {
  showMessage($("#msg"), texto, tipo);
  if (texto) $("#msg").scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function campo(rotulo, controle, dica) {
  if (!controle.id) controle.id = novoId();
  return el("div", { class: "field" }, el("label", { for: controle.id }, rotulo), controle, dica ? el("small", { class: "muted" }, dica) : null);
}

function seletor(opcoes, atual, atributos = {}) {
  return el("select", { id: novoId("s"), ...atributos },
    opcoes.map(([valor, rotulo]) => el("option", { value: valor, selected: String(valor) === String(atual) }, rotulo)));
}

const insigniaNivel = (nivel) => el("span", { class: `badge nivel-${nivel}` }, DIFFICULTY[nivel] || nivel);
const insigniaEstado = (ativo) => el("span", { class: `badge ${ativo ? "ativo" : "inativo"}` }, ativo ? "Ativo" : "Inativo");

function tabela(cabecalhos, linhas, vazio) {
  return el("div", { class: "card table-wrap" }, el("table", {},
    el("thead", {}, el("tr", {}, cabecalhos.map((c) => el("th", { scope: "col" }, c)))),
    el("tbody", {}, linhas.length ? linhas : [el("tr", {}, el("td", { colspan: String(cabecalhos.length), class: "muted" }, vazio))])));
}

async function carregarCategorias() {
  categorias = await api("/categories");
  return categorias;
}

const opcoesDeArea = (comTodas) => [...(comTodas ? [["", "Todas as áreas"]] : []), ...categorias.map((c) => [c.id, c.name])];
const opcoesDeNivel = (comTodos) => [...(comTodos ? [["", "Todos os níveis"]] : []), ...NIVEIS.map((n) => [n, DIFFICULTY[n]])];

// ---------- navegacao entre secoes ----------
const SECOES = [
  ["resumo", "Resumo", () => viewResumo()],
  ["quizzes", "Quizzes", () => viewQuizzes()],
  ["areas", "Áreas", () => viewAreas()],
  ["usuarios", "Usuários", () => viewUsuarios()],
];
let secao = "resumo";

function renderAbas() {
  $("#tabs").replaceChildren(...SECOES.map(([id, rotulo]) => el("button", {
    type: "button", role: "tab", class: "tab", "aria-selected": String(secao === id), onclick: () => irPara(id),
  }, rotulo)));
}

function irPara(id) {
  secao = id;
  history.replaceState(null, "", `#${id}`);
  aviso("");
  renderAbas();
  abrir();
}

async function abrir() {
  painel.replaceChildren(el("p", { class: "muted", role: "status" }, "Carregando…"));
  try {
    await SECOES.find(([id]) => id === secao)[2]();
  } catch (erro) {
    painel.replaceChildren();
    aviso(erro.message);
  }
}

// ---------- resumo ----------
async function viewResumo() {
  const [s, atividade] = await Promise.all([api("/admin/stats"), api("/admin/activity")]);
  const numero = (valor, rotulo) => el("div", { class: "card stat" }, el("strong", {}, valor), rotulo);
  const maior = Math.max(1, ...s.top_categories.map((c) => c.results));

  painel.replaceChildren(
    el("div", { class: "stats" },
      numero(s.users, "usuários"), numero(s.categories, "áreas"), numero(s.quizzes, "quizzes"), numero(s.questions, "perguntas"),
      numero(s.results, "resultados"), numero(s.certificates, "certificados"), numero(`${s.pass_rate}%`, "aprovação")),
    el("h2", { class: "sub" }, "Movimento recente"),
    el("div", { class: "stats" },
      numero(s.users_7d, "novos usuários (7 dias)"), numero(s.results_7d, "quizzes realizados (7 dias)"),
      numero(s.certificates_7d, "certificados (7 dias)"), numero(s.active_users_week, "usuários ativos na semana")),
    el("h2", { class: "sub" }, "Áreas mais realizadas"),
    el("div", { class: "card" }, s.top_categories.length
      ? el("ol", { class: "top-areas" }, s.top_categories.map((c) => el("li", {},
        el("span", { class: "top-nome" }, c.name),
        el("span", { class: "bar", "aria-hidden": "true" }, el("span", { style: `width:${Math.round((c.results / maior) * 100)}%` })),
        el("span", { class: "top-valor" }, `${c.results}`))))
      : el("p", { class: "muted" }, "Ainda não há quizzes respondidos.")),
    el("h2", { class: "sub" }, "Últimos resultados"),
    tabela(["Quando", "Pessoa", "Quiz", "Nível", "Acertos", "Situação"],
      atividade.map((a) => el("tr", {},
        el("td", {}, dataHora(a.created_at)), el("td", {}, a.user_name), el("td", {}, a.quiz_title),
        el("td", {}, insigniaNivel(a.difficulty)), el("td", {}, `${a.percentage}%`),
        el("td", {}, a.passed ? (a.certificate ? "Aprovado · certificado" : "Aprovado") : "Não aprovado"))),
      "Nenhum quiz foi respondido até o momento."));
}

// ---------- quizzes ----------
const filtros = { q: "", category: "", difficulty: "" };

async function viewQuizzes() {
  await carregarCategorias();
  const lista = el("div", { id: "lista-quizzes" });
  let espera = null;

  const busca = el("input", { id: "busca-quiz", type: "search", placeholder: "Buscar por quiz ou área", "aria-label": "Buscar quizzes", value: filtros.q });
  busca.addEventListener("input", () => {
    filtros.q = busca.value;
    clearTimeout(espera);
    espera = setTimeout(atualizar, 300);
  });
  const porArea = seletor(opcoesDeArea(true), filtros.category, { "aria-label": "Filtrar por área" });
  porArea.addEventListener("change", () => { filtros.category = porArea.value; atualizar(); });
  const porNivel = seletor(opcoesDeNivel(true), filtros.difficulty, { "aria-label": "Filtrar por nível" });
  porNivel.addEventListener("change", () => { filtros.difficulty = porNivel.value; atualizar(); });

  async function atualizar() {
    const q = new URLSearchParams();
    if (filtros.q.trim()) q.set("q", filtros.q.trim());
    if (filtros.category) q.set("category_id", filtros.category);
    if (filtros.difficulty) q.set("difficulty", filtros.difficulty);
    try {
      const quizzes = await api(`/admin/quizzes${q.toString() ? `?${q}` : ""}`);
      lista.replaceChildren(el("p", { class: "muted" }, `${quizzes.length} quiz(zes)`), tabela(
        ["Quiz", "Área", "Nível", "Perguntas", "Resultados", "Situação", "Ações"],
        quizzes.map((quiz) => el("tr", {},
          el("td", {}, quiz.title), el("td", {}, quiz.category_name), el("td", {}, insigniaNivel(quiz.difficulty)),
          el("td", {}, quiz.question_count), el("td", {}, quiz.result_count), el("td", {}, insigniaEstado(quiz.is_active)),
          el("td", { class: "row-actions" },
            el("button", { class: "btn small", type: "button", onclick: () => editarQuiz(quiz.id) }, "Editar"),
            el("button", { class: "btn small secondary", type: "button", onclick: () => alternarQuiz(quiz, atualizar) }, quiz.is_active ? "Desativar" : "Ativar"),
            el("button", { class: "btn small danger-btn", type: "button", onclick: () => excluirQuiz(quiz, atualizar) }, "Excluir")))),
        "Nenhum quiz encontrado com os filtros selecionados."));
    } catch (erro) {
      aviso(erro.message);
    }
  }

  painel.replaceChildren(
    el("div", { class: "toolbar admin-toolbar" }, busca, porArea, porNivel,
      el("button", { class: "btn", type: "button", onclick: () => editarQuiz(null) }, "Novo quiz")),
    lista);
  await atualizar();
}

const corpoDoQuiz = (q) => ({
  title: q.title, description: q.description, category_id: q.category_id, difficulty: q.difficulty, time_limit: q.time_limit, is_active: q.is_active,
});

async function alternarQuiz(quiz, aoConcluir) {
  try {
    await api(`/admin/quizzes/${quiz.id}`, { method: "PUT", body: { ...corpoDoQuiz(quiz), is_active: !quiz.is_active } });
    aviso(`Quiz ${quiz.is_active ? "desativado" : "ativado"}.`, "ok");
    await aoConcluir();
  } catch (erro) {
    aviso(erro.message);
  }
}

async function excluirQuiz(quiz, aoConcluir) {
  const temHistorico = quiz.result_count > 0;
  const pergunta = temHistorico
    ? `"${quiz.title}" já possui ${quiz.result_count} resultado(s). Por esse motivo, ele será apenas DESATIVADO (deixará de ser exibido aos usuários, mas o histórico e os certificados serão mantidos). Deseja continuar?`
    : `Excluir definitivamente "${quiz.title}" e as suas perguntas?`;
  if (!confirm(pergunta)) return;
  try {
    await api(`/admin/quizzes/${quiz.id}`, { method: "DELETE" });
    aviso(temHistorico ? "Quiz desativado (possui histórico e, por isso, não foi excluído)." : "Quiz excluído.", "ok");
    await aoConcluir();
  } catch (erro) {
    aviso(erro.message);
  }
}

async function editarQuiz(id) {
  aviso("");
  await carregarCategorias();
  let quiz = null;
  if (id) {
    try {
      quiz = await api(`/admin/quizzes/${id}`);
    } catch (erro) {
      return aviso(erro.message);
    }
  }
  const titulo = el("input", { type: "text", maxlength: 120, required: true, value: quiz ? quiz.title : "" });
  const descricao = el("textarea", { rows: 2, maxlength: 500 }, quiz ? quiz.description : "");
  const area = seletor(opcoesDeArea(false), quiz ? quiz.category_id : (filtros.category || categorias[0]?.id || ""));
  const nivel = seletor(opcoesDeNivel(false), quiz ? quiz.difficulty : "media");
  const tempo = el("input", { type: "number", min: 0, max: 7200, step: 1, value: quiz ? quiz.time_limit : 300 });
  const ativo = el("input", { type: "checkbox", id: novoId(), checked: quiz ? quiz.is_active : true });
  const status = el("div", { "aria-live": "polite" });

  const formulario = el("form", {
    class: "card form-wide", novalidate: true,
    onsubmit: async (evento) => {
      evento.preventDefault();
      const corpo = {
        title: titulo.value.trim(), description: descricao.value.trim(), category_id: Number(area.value), difficulty: nivel.value,
        time_limit: Number(tempo.value), is_active: ativo.checked,
      };
      if (corpo.title.length < 2) return showMessage(status, "Informe o título do quiz.");
      if (!Number.isInteger(corpo.time_limit) || corpo.time_limit < 0) return showMessage(status, "O tempo limite deve ser um número inteiro de segundos (0 = sem limite).");
      try {
        const salvo = await api(id ? `/admin/quizzes/${id}` : "/admin/quizzes", { method: id ? "PUT" : "POST", body: corpo });
        aviso(id ? "Quiz salvo." : "Quiz criado. Adicione as perguntas em seguida.", "ok");
        await editarQuiz(salvo.id);
      } catch (erro) {
        showMessage(status, erro.message);
      }
    },
  },
  el("h2", { class: "sub" }, id ? "Editar quiz" : "Novo quiz"),
  status,
  campo("Título", titulo),
  campo("Descrição", descricao),
  el("div", { class: "form-grid" },
    campo("Área", area), campo("Nível", nivel), campo("Tempo limite (segundos, 0 = sem limite)", tempo)),
  el("div", { class: "field check" }, el("label", {}, ativo, "Ativo (exibido aos usuários)")),
  el("div", { class: "row-actions" },
    el("button", { class: "btn", type: "submit" }, "Salvar quiz"),
    el("button", { class: "btn secondary", type: "button", onclick: () => irPara("quizzes") }, "Voltar à lista")));

  const blocoPerguntas = el("div", { id: "perguntas" });
  painel.replaceChildren(formulario, quiz ? blocoPerguntas : el("p", { class: "muted" }, "Salve o quiz para poder adicionar perguntas."));
  if (quiz) desenharPerguntas(blocoPerguntas, quiz);
}

// ---------- perguntas de um quiz ----------
function desenharPerguntas(bloco, quiz) {
  const recarregar = async () => editarQuiz(quiz.id);
  const areaForm = el("div", { id: "form-pergunta" });

  const abrirForm = (pergunta) => {
    areaForm.replaceChildren(formPergunta({
      quizId: quiz.id, pergunta,
      aoSalvar: async () => { aviso(pergunta ? "Pergunta salva." : "Pergunta adicionada.", "ok"); await recarregar(); },
      aoCancelar: () => areaForm.replaceChildren(),
    }));
    areaForm.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  bloco.replaceChildren(
    el("h2", { class: "sub" }, `Perguntas (${quiz.questions.length}) · ${quiz.total_points} pontos`),
    el("p", { class: "muted" }, "Cada pergunta possui exatamente uma alternativa correta. As alterações valem para quem responder a partir de agora; resultados e certificados anteriores não são modificados."),
    ...quiz.questions.map((p, indice) => el("article", { class: "card pergunta-item" },
      el("div", { class: "pergunta-topo" },
        el("strong", {}, `${indice + 1}. ${p.text}`),
        el("span", { class: "badge" }, `${p.points} pts`)),
      el("ul", { class: "alternativas" }, p.alternatives.map((a) => el("li", { class: a.is_correct ? "correta" : "" },
        a.is_correct ? icone("check-circle", { tamanho: 16, classe: "certo" }) : el("span", { class: "marcador", "aria-hidden": "true" }),
        el("span", {}, a.text),
        a.is_correct ? el("span", { class: "sr-only" }, " (correta)") : null))),
      el("div", { class: "row-actions" },
        el("button", { class: "btn small", type: "button", onclick: () => abrirForm(p) }, "Editar"),
        el("button", {
          class: "btn small danger-btn", type: "button",
          onclick: async () => {
            if (!confirm("Excluir esta pergunta?")) return;
            try {
              await api(`/admin/questions/${p.id}`, { method: "DELETE" });
              aviso("Pergunta excluída.", "ok");
              await recarregar();
            } catch (erro) {
              aviso(erro.message);
            }
          },
        }, "Excluir")))),
    el("div", { class: "row-actions" },
      el("button", { class: "btn", type: "button", onclick: () => abrirForm(null) }, "Adicionar pergunta")),
    areaForm);
}

function formPergunta({ quizId, pergunta, aoSalvar, aoCancelar }) {
  const alternativas = pergunta
    ? pergunta.alternatives.map((a) => ({ texto: a.text, correta: a.is_correct }))
    : [{ texto: "", correta: true }, { texto: "", correta: false }, { texto: "", correta: false }, { texto: "", correta: false }];
  const grupo = novoId("correta");
  const texto = el("textarea", { rows: 3, maxlength: 1000, required: true }, pergunta ? pergunta.text : "");
  const pontos = el("input", { type: "number", min: 1, max: 100, step: 1, value: pergunta ? pergunta.points : 10 });
  const lista = el("div", { class: "alts" });
  const status = el("div", { "aria-live": "polite" });

  const desenhar = () => lista.replaceChildren(...alternativas.map((a, i) => el("div", { class: "alt-row" },
    el("label", { class: "alt-correta", title: "Marcar como a alternativa correta" },
      el("input", { type: "radio", name: grupo, checked: a.correta, onchange: () => alternativas.forEach((x, j) => { x.correta = j === i; }) }),
      el("span", {}, "Correta")),
    el("input", {
      type: "text", maxlength: 500, value: a.texto, "aria-label": `Texto da alternativa ${i + 1}`,
      oninput: (evento) => { a.texto = evento.target.value; },
    }),
    alternativas.length > 2
      ? el("button", {
        class: "btn small secondary", type: "button",
        onclick: () => {
          const eraCorreta = alternativas[i].correta;
          alternativas.splice(i, 1);
          if (eraCorreta) alternativas[0].correta = true;
          desenhar();
        },
      }, "Remover")
      : null)));
  desenhar();

  return el("form", {
    class: "card form-wide", novalidate: true,
    onsubmit: async (evento) => {
      evento.preventDefault();
      const limpas = alternativas.map((a) => ({ text: a.texto.trim(), is_correct: a.correta }));
      const pts = Number(pontos.value);
      if (texto.value.trim().length < 3) return showMessage(status, "Informe o enunciado da pergunta.");
      if (!Number.isInteger(pts) || pts < 1 || pts > 100) return showMessage(status, "A pontuação deve ser um número inteiro de 1 a 100.");
      if (limpas.some((a) => !a.text)) return showMessage(status, "Preencha todas as alternativas ou remova as vazias.");
      if (limpas.filter((a) => a.is_correct).length !== 1) return showMessage(status, "Marque exatamente uma alternativa como correta.");
      try {
        await api(pergunta ? `/admin/questions/${pergunta.id}` : "/admin/questions", {
          method: pergunta ? "PUT" : "POST",
          body: { quiz_id: quizId, text: texto.value.trim(), points: pts, alternatives: limpas },
        });
        await aoSalvar();
      } catch (erro) {
        showMessage(status, erro.message);
      }
    },
  },
  el("h3", {}, pergunta ? "Editar pergunta" : "Nova pergunta"),
  status,
  campo("Enunciado", texto),
  campo("Pontos (1 a 100)", pontos),
  el("fieldset", { class: "alts-set" }, el("legend", {}, "Alternativas (de 2 a 6)"), lista,
    el("button", {
      class: "btn small secondary", type: "button",
      onclick: () => {
        if (alternativas.length >= 6) return showMessage(status, "No máximo 6 alternativas.");
        alternativas.push({ texto: "", correta: false });
        desenhar();
      },
    }, "Adicionar alternativa")),
  el("div", { class: "row-actions" },
    el("button", { class: "btn", type: "submit" }, "Salvar pergunta"),
    el("button", { class: "btn secondary", type: "button", onclick: aoCancelar }, "Cancelar")));
}

// ---------- areas ----------
const semAcentos = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const gerarSlug = (nome) => semAcentos(nome).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

async function viewAreas() {
  await carregarCategorias();
  painel.replaceChildren(
    el("div", { class: "toolbar admin-toolbar" },
      el("p", { class: "muted", style: "margin:0;flex:1" }, `${categorias.length} áreas`),
      el("button", { class: "btn", type: "button", onclick: () => editarArea(null) }, "Nova área")),
    tabela(["", "Nome", "Grupo", "Slug", "Quizzes ativos", "Ações"],
      categorias.map((c) => el("tr", {},
        el("td", { class: "icone-celula", "aria-hidden": "true" }, icone(c.icon, { tamanho: 22 })),
        el("td", {}, c.name), el("td", {}, c.group), el("td", {}, el("code", {}, c.slug)), el("td", {}, c.quiz_count),
        el("td", { class: "row-actions" },
          el("button", { class: "btn small", type: "button", onclick: () => editarArea(c) }, "Editar"),
          el("button", {
            class: "btn small danger-btn", type: "button",
            onclick: async () => {
              if (!confirm(`Excluir a área "${c.name}" e os respectivos quizzes? A exclusão só é possível se nenhum usuário tiver respondido.`)) return;
              try {
                await api(`/admin/categories/${c.id}`, { method: "DELETE" });
                aviso("Área excluída.", "ok");
                await viewAreas();
              } catch (erro) {
                aviso(erro.message);
              }
            },
          }, "Excluir")))),
      "Nenhuma área cadastrada."));
}

function editarArea(cat) {
  aviso("");
  const nome = el("input", { type: "text", maxlength: 80, required: true, value: cat ? cat.name : "" });
  const slug = el("input", { type: "text", maxlength: 80, required: true, value: cat ? cat.slug : "", pattern: "[a-z0-9-]{2,80}" });
  const grupo = el("input", { type: "text", maxlength: 60, required: true, value: cat ? cat.group : "", list: "grupos" });
  const iconeSel = seletor(NOMES_DE_ICONES.map((n) => [n, n]), cat ? cat.icon : "code");
  const previa = el("span", { class: "icone-previa", "aria-hidden": "true" }, icone(iconeSel.value, { tamanho: 28 }));
  const descricao = el("textarea", { rows: 2, maxlength: 500 }, cat ? cat.description : "");
  const status = el("div", { "aria-live": "polite" });
  let slugManual = Boolean(cat);

  slug.addEventListener("input", () => { slugManual = true; });
  nome.addEventListener("input", () => { if (!slugManual) slug.value = gerarSlug(nome.value); });
  iconeSel.addEventListener("change", () => previa.replaceChildren(icone(iconeSel.value, { tamanho: 28 })));

  painel.replaceChildren(el("form", {
    class: "card form-wide", novalidate: true,
    onsubmit: async (evento) => {
      evento.preventDefault();
      try {
        await api(cat ? `/admin/categories/${cat.id}` : "/admin/categories", {
          method: cat ? "PUT" : "POST",
          body: { name: nome.value.trim(), slug: slug.value.trim(), group: grupo.value.trim(), icon: iconeSel.value, description: descricao.value.trim() },
        });
        aviso(cat ? "Área salva." : "Área criada. Crie os quizzes correspondentes na aba Quizzes.", "ok");
        await viewAreas();
      } catch (erro) {
        showMessage(status, erro.message);
      }
    },
  },
  el("h2", { class: "sub" }, cat ? "Editar área" : "Nova área"),
  status,
  el("div", { class: "form-grid" }, campo("Nome", nome), campo("Slug (endereço interno, sem acentos)", slug)),
  campo("Grupo", grupo, "Escolha um grupo existente ou digite um novo."),
  el("datalist", { id: "grupos" }, [...new Set(categorias.map((c) => c.group))].map((g) => el("option", { value: g }))),
  el("div", { class: "field" }, el("label", { for: iconeSel.id }, "Ícone"), el("div", { class: "icone-linha" }, iconeSel, previa)),
  campo("Descrição", descricao),
  el("div", { class: "row-actions" },
    el("button", { class: "btn", type: "submit" }, "Salvar área"),
    el("button", { class: "btn secondary", type: "button", onclick: () => irPara("areas") }, "Voltar à lista"))));
}

// ---------- usuarios ----------
async function viewUsuarios() {
  const tamanho = 50;
  let pagina = 1;
  let termo = "";
  let espera = null;
  const corpo = el("tbody", {});
  const mais = el("button", { class: "btn secondary", type: "button", hidden: true, onclick: () => carregar(false) }, "Carregar mais");
  const busca = el("input", { id: "busca-usuario", type: "search", placeholder: "Buscar por nome ou e-mail", "aria-label": "Buscar usuários" });

  const linha = (u) => el("tr", {},
    el("td", {}, u.name), el("td", {}, u.email),
    el("td", {}, u.is_admin ? el("span", { class: "badge nivel-dificil" }, "Administrador") : el("span", { class: "badge" }, "Usuário")),
    el("td", {}, u.result_count), el("td", {}, u.certificate_count), el("td", {}, fmtDate(u.created_at)),
    el("td", { class: "row-actions" }, u.id === euMesmo.id
      ? el("span", { class: "muted" }, "Você")
      : el("button", {
        class: "btn small secondary", type: "button",
        onclick: async () => {
          const promover = !u.is_admin;
          if (!confirm(promover ? `Dar acesso de administrador a ${u.name}?` : `Remover o acesso de administrador de ${u.name}?`)) return;
          try {
            await api(`/admin/users/${u.id}/admin`, { method: "PUT", body: { is_admin: promover } });
            aviso(promover ? `${u.name} agora é administrador.` : `${u.name} deixou de ser administrador.`, "ok");
            await carregar(true);
          } catch (erro) {
            aviso(erro.message);
          }
        },
      }, u.is_admin ? "Remover administração" : "Tornar administrador")));

  async function carregar(recomecar) {
    if (recomecar) pagina = 1; else pagina += 1;
    const q = new URLSearchParams({ limit: String(tamanho), page: String(pagina) });
    if (termo) q.set("q", termo);
    try {
      const usuarios = await api(`/admin/users?${q}`);
      if (recomecar) corpo.replaceChildren();
      corpo.append(...usuarios.map(linha));
      if (recomecar && !usuarios.length) corpo.append(el("tr", {}, el("td", { colspan: "7", class: "muted" }, "Nenhum usuário encontrado.")));
      mais.hidden = usuarios.length < tamanho;
    } catch (erro) {
      aviso(erro.message);
    }
  }

  busca.addEventListener("input", () => {
    clearTimeout(espera);
    espera = setTimeout(() => { termo = busca.value.trim(); carregar(true); }, 300);
  });

  painel.replaceChildren(
    el("div", { class: "toolbar admin-toolbar" }, busca),
    el("div", { class: "card table-wrap" }, el("table", {},
      el("thead", {}, el("tr", {}, ["Nome", "E-mail", "Perfil", "Quizzes", "Certificados", "Cadastro", "Ações"].map((c) => el("th", { scope: "col" }, c)))),
      corpo)),
    el("div", { class: "row-actions" }, mais));
  await carregar(true);
}

// ---------- inicio ----------
(async () => {
  if (!requireLogin()) return;
  try {
    euMesmo = await api("/users/me");
    setSession(getToken(), { ...getUser(), ...euMesmo }); // atualiza o perfil guardado (mostra/esconde o link "Painel")
  } catch (erro) {
    return aviso(erro.message);
  }
  if (!euMesmo.is_admin) {
    return aviso("Esta área é restrita a administradores.");
  }
  const pedida = location.hash.slice(1);
  if (SECOES.some(([id]) => id === pedida)) secao = pedida;
  $("#tabs").hidden = false;
  renderAbas();
  abrir();
})();
