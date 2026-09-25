"use strict";

// Nao aceita espaco, @ nem caracteres que abrem marcacao HTML ou aspas: um e-mail assim nunca e' legitimo.
const EMAIL_RE = /^[^\s@<>"'`]+@[^\s@<>"'`]+\.[^\s@<>"'`]+$/;

const NOME_MIN = 2;
const NOME_MAX = 80;
const EMAIL_MAX = 160;
// O bcrypt so' considera os primeiros 72 bytes da senha: aceitar mais que isso daria falsa seguranca.
const SENHA_MIN = 8;
const SENHA_MAX_BYTES = 72;
const SENHAS_COMUNS = new Set([
  "12345678", "123456789", "1234567890", "12341234", "11111111", "00000000", "87654321", "password",
  "password1", "senha123", "senha1234", "senhasenha", "qwertyui", "qwerty123", "abc12345", "iloveyou",
  "admin123", "brasil123", "mudar123", "123mudar", "minhasenha",
]);

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeNome(nome) {
  return String(nome || "").split(/\s+/).filter(Boolean).join(" ");
}

/** Regras da senha nova. Devolve a mensagem de erro ou null. */
function validarSenhaNova(senha) {
  const texto = String(senha || "");
  if (texto.length < SENHA_MIN) return "A senha precisa ter pelo menos 8 caracteres.";
  if (Buffer.byteLength(texto, "utf8") > SENHA_MAX_BYTES) {
    return "A senha pode ter no máximo 72 bytes (cerca de 72 caracteres; acentos e emojis ocupam mais).";
  }
  if (SENHAS_COMUNS.has(texto.toLowerCase())) return "Essa senha é muito comum. Escolha outra.";
  return null;
}

function validarNome(nome) {
  if (nome.length < NOME_MIN) return "Informe seu nome completo.";
  if (nome.length > NOME_MAX) return `O nome pode ter no máximo ${NOME_MAX} caracteres.`;
  return null;
}

function validateRegister({ name, email, password }) {
  const erros = {};
  const nome = normalizeNome(name);
  const erroNome = validarNome(nome);
  if (erroNome) erros.name = erroNome;

  const emailLimpo = normalizeEmail(email);
  if (!emailLimpo) erros.email = "O e-mail é obrigatório.";
  else if (emailLimpo.length > EMAIL_MAX || !EMAIL_RE.test(emailLimpo)) erros.email = "Informe um e-mail válido.";

  const erroSenha = validarSenhaNova(password);
  if (erroSenha) erros.password = erroSenha;

  return { valido: Object.keys(erros).length === 0, erros, nome, email: emailLimpo };
}

function validateLogin({ email, password }) {
  const erros = {};
  const emailLimpo = normalizeEmail(email);
  if (!emailLimpo) erros.email = "Informe o e-mail.";
  if (!password || typeof password !== "string") erros.password = "Informe a senha.";
  return { valido: Object.keys(erros).length === 0, erros, email: emailLimpo };
}

function validateEsqueciSenha({ email }) {
  const emailLimpo = normalizeEmail(email);
  const valido = Boolean(emailLimpo) && emailLimpo.length <= EMAIL_MAX && EMAIL_RE.test(emailLimpo);
  return { valido, erros: valido ? {} : { email: "Informe um e-mail válido." }, email: emailLimpo };
}

function validateRedefinirSenha({ token, password }) {
  const erros = {};
  const tokenOk = typeof token === "string" && /^[A-Za-z0-9_-]{20,100}$/.test(token);
  if (!tokenOk) erros.token = "Link inválido. Abra novamente o link recebido por e-mail.";
  const erroSenha = validarSenhaNova(password);
  if (erroSenha) erros.password = erroSenha;
  return { valido: Object.keys(erros).length === 0, erros };
}

function validateNomePerfil({ name }) {
  const nome = normalizeNome(name);
  const erro = validarNome(nome);
  return { valido: !erro, erros: erro ? { name: erro } : {}, nome };
}

const inteiro = (v) => Number.isInteger(v);

function validateSubmit({ answers, time_spent: tempo } = {}) {
  const erros = {};
  if (!Array.isArray(answers)) erros.answers = "Envie a lista de respostas.";
  else if (answers.length > 200) erros.answers = "Respostas demais.";
  else if (!answers.every((a) => a && inteiro(a.question_id) && (a.alternative_id === null || a.alternative_id === undefined || inteiro(a.alternative_id)))) {
    erros.answers = "Formato de resposta inválido.";
  }
  const tempoGasto = tempo === undefined ? 0 : tempo;
  if (!inteiro(tempoGasto) || tempoGasto < 0 || tempoGasto > 86400) erros.time_spent = "Tempo inválido.";
  return { valido: Object.keys(erros).length === 0, erros, answers: answers || [], tempoGasto };
}

const DIFICULDADES = ["facil", "media", "dificil"];

function validateCategoria(b = {}) {
  const erros = {};
  const nome = normalizeNome(b.name);
  if (nome.length < 2 || nome.length > 80) erros.name = "O nome deve ter de 2 a 80 caracteres.";
  const slug = String(b.slug || "");
  if (!/^[a-z0-9-]{2,80}$/.test(slug)) erros.slug = "Use 2 a 80 letras minúsculas, números ou hífens.";
  const grupo = normalizeNome(b.group);
  if (grupo.length < 2 || grupo.length > 60) erros.group = "O grupo deve ter de 2 a 60 caracteres.";
  const icone = String(b.icon || "").slice(0, 16);
  const descricao = String(b.description || "").slice(0, 500);
  return { valido: Object.keys(erros).length === 0, erros, dados: { nome, slug, grupo, icone, descricao } };
}

function validateQuiz(b = {}) {
  const erros = {};
  const titulo = normalizeNome(b.title);
  if (titulo.length < 2 || titulo.length > 120) erros.title = "O título deve ter de 2 a 120 caracteres.";
  if (!inteiro(b.category_id)) erros.category_id = "Informe a categoria.";
  const dificuldade = b.difficulty === undefined ? "media" : b.difficulty;
  if (!DIFICULDADES.includes(dificuldade)) erros.difficulty = "Dificuldade inválida.";
  const limite = b.time_limit === undefined ? 0 : b.time_limit;
  if (!inteiro(limite) || limite < 0 || limite > 7200) erros.time_limit = "Tempo limite inválido (0 a 7200 segundos).";
  const ativo = b.is_active === undefined ? true : b.is_active;
  if (typeof ativo !== "boolean") erros.is_active = "Valor inválido.";
  return {
    valido: Object.keys(erros).length === 0,
    erros,
    dados: { titulo, descricao: String(b.description || "").slice(0, 500), categoriaId: b.category_id, dificuldade, limiteTempo: limite, ativo },
  };
}

function validatePergunta(b = {}, { exigeQuiz = true } = {}) {
  const erros = {};
  if (exigeQuiz && !inteiro(b.quiz_id)) erros.quiz_id = "Informe o quiz.";
  const texto = String(b.text || "").trim();
  if (texto.length < 3 || texto.length > 1000) erros.text = "O enunciado deve ter de 3 a 1000 caracteres.";
  const pontos = b.points === undefined ? 10 : b.points;
  if (!inteiro(pontos) || pontos < 1 || pontos > 100) erros.points = "Pontos devem ir de 1 a 100.";
  const alts = Array.isArray(b.alternatives) ? b.alternatives : [];
  if (alts.length < 2 || alts.length > 6) erros.alternatives = "Informe de 2 a 6 alternativas.";
  else if (!alts.every((a) => a && typeof a.text === "string" && a.text.trim().length >= 1 && a.text.length <= 500)) {
    erros.alternatives = "Cada alternativa precisa de texto (até 500 caracteres).";
  } else if (alts.filter((a) => a.is_correct === true).length !== 1) {
    erros.alternatives = "Informe exatamente uma alternativa correta.";
  }
  return {
    valido: Object.keys(erros).length === 0,
    erros,
    dados: { quizId: b.quiz_id, texto, pontos, alternativas: alts.map((a) => ({ texto: String(a.text || "").trim(), correta: a.is_correct === true })) },
  };
}

module.exports = {
  EMAIL_RE, normalizeEmail, normalizeNome, validarSenhaNova,
  validateRegister, validateLogin, validateEsqueciSenha, validateRedefinirSenha, validateNomePerfil, validateSubmit,
  validateCategoria, validateQuiz, validatePergunta,
};
