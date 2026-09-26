"use strict";

/**
 * Executa uma tarefa depois de a resposta ter sido enviada (ex.: enviar e-mail) sem atrasar nem alterar a resposta.
 * Em funcoes sem servidor (Vercel) o processo pode ser congelado assim que a resposta sai; `waitUntil` avisa a
 * plataforma para esperar a tarefa terminar. Fora do Vercel a tarefa apenas segue rodando (processo continuo).
 * Erros sao registrados e nunca propagados.
 */
function emSegundoPlano(tarefa, rotulo = "tarefa em segundo plano") {
  const promessa = Promise.resolve(tarefa).catch((err) => {
    // eslint-disable-next-line no-console
    console.error(`[${rotulo}] falha:`, err && err.message);
  });
  if (process.env.VERCEL) {
    try {
      // eslint-disable-next-line global-require
      require("@vercel/functions").waitUntil(promessa);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[segundo plano] waitUntil indisponivel:", err.message);
    }
  }
  return promessa;
}

module.exports = { emSegundoPlano };
