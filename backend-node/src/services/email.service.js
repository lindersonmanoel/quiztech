"use strict";

// Envio de e-mail por SMTP (nodemailer). Em teste nada sai da maquina: as mensagens ficam em `caixaDeTeste`.

const nodemailer = require("nodemailer");
const config = require("../config");

const caixaDeTeste = [];
let transporte = null;

function configurado() {
  return config.isTest || Boolean(config.smtp.host);
}

function obterTransporte() {
  if (!transporte) {
    const { host, port, secure, user, pass } = config.smtp;
    transporte = nodemailer.createTransport({
      host, port, secure,
      auth: user ? { user, pass } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });
  }
  return transporte;
}

/** Escapa texto que vai dentro de HTML (nome do usuario etc.). */
function esc(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function enviar({ para, assunto, texto, html }) {
  if (config.isTest) {
    caixaDeTeste.push({ para, assunto, texto, html });
    return;
  }
  if (!config.smtp.host) throw new Error("SMTP não configurado (defina SMTP_HOST, SMTP_USER e SMTP_PASS).");
  await obterTransporte().sendMail({ from: config.smtp.from, to: para, subject: assunto, text: texto, html });
}

/** Moldura simples (tabela + estilos inline: a maioria dos leitores de e-mail ignora <style>). */
function moldura(titulo, corpoHtml) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#010e24;padding:24px;font-family:Segoe UI,Arial,sans-serif;color:#e8f1ff">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:520px;background:#01183c;border:1px solid #0950bd;border-radius:14px" cellspacing="0" cellpadding="0"><tr><td style="padding:28px">
<p style="margin:0 0 18px;font-size:20px;font-weight:800;letter-spacing:2px;color:#01d6fc">QUIZ TECH</p>
<h1 style="margin:0 0 14px;font-size:20px;color:#ffffff">${esc(titulo)}</h1>
${corpoHtml}
</td></tr></table></td></tr></table></body></html>`;
}

function botao(href, rotulo) {
  return `<p style="margin:22px 0"><a href="${esc(href)}" style="display:inline-block;background:#0068fc;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px">${esc(rotulo)}</a></p>`;
}

async function enviarRedefinicaoDeSenha({ para, nome, link, minutos }) {
  const primeiro = String(nome || "").split(/\s+/)[0] || "";
  const validade = minutos >= 60 && minutos % 60 === 0 ? `${minutos / 60} hora${minutos > 60 ? "s" : ""}` : `${minutos} minutos`;
  await enviar({
    para,
    assunto: "Redefinição de senha — QUIZ TECH",
    texto: `Olá${primeiro ? `, ${primeiro}` : ""}!\n\nRecebemos um pedido para redefinir a senha da sua conta no QUIZ TECH.\n` +
      `Abra o link abaixo para escolher uma nova senha (vale por ${validade} e só pode ser usado uma vez):\n\n${link}\n\n` +
      "Se não foi você, ignore este e-mail: sua senha continua a mesma.\n",
    html: moldura("Redefinição de senha",
      `<p style="line-height:1.5">Olá${primeiro ? `, ${esc(primeiro)}` : ""}! Recebemos um pedido para redefinir a senha da sua conta.</p>` +
      botao(link, "Escolher nova senha") +
      `<p style="color:#8fb4dd;font-size:14px;line-height:1.5">O link vale por ${esc(validade)} e só pode ser usado uma vez. Se o botão não abrir, copie este endereço no navegador:<br><span style="word-break:break-all">${esc(link)}</span></p>` +
      `<p style="color:#8fb4dd;font-size:14px">Se não foi você, ignore este e-mail: sua senha continua a mesma.</p>`),
  });
}

async function enviarSenhaAlterada({ para, nome }) {
  const primeiro = String(nome || "").split(/\s+/)[0] || "";
  await enviar({
    para,
    assunto: "Sua senha foi alterada — QUIZ TECH",
    texto: `Olá${primeiro ? `, ${primeiro}` : ""}!\n\nA senha da sua conta no QUIZ TECH acabou de ser alterada e as sessões abertas foram encerradas.\n` +
      "Se foi você, nada a fazer. Se não foi, peça uma nova redefinição de senha agora mesmo.\n",
    html: moldura("Senha alterada",
      `<p style="line-height:1.5">Olá${primeiro ? `, ${esc(primeiro)}` : ""}! A senha da sua conta acabou de ser alterada e as sessões abertas foram encerradas.</p>` +
      `<p style="color:#8fb4dd;font-size:14px;line-height:1.5">Se foi você, nada a fazer. Se não foi, peça uma nova redefinição de senha agora mesmo.</p>`),
  });
}

module.exports = { configurado, enviar, enviarRedefinicaoDeSenha, enviarSenhaAlterada, caixaDeTeste };
