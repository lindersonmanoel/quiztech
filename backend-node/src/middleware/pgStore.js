"use strict";

// Armazenamento do express-rate-limit no PostgreSQL (tabela rate_limits), para hospedagem com varias instancias
// (ex.: funcoes do Vercel), onde um contador em memoria seria por instancia e nao limitaria nada.
// Interface exigida pelo express-rate-limit v7: init, increment, decrement, resetKey.

const pool = require("../database/pool");

const LIMPEZA_UMA_EM = 50; // a cada ~50 incrementos apaga contadores vencidos ha mais de 1 hora

class PgStore {
  constructor({ banco = pool } = {}) {
    this.banco = banco;
    this.windowMs = 15 * 60 * 1000;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  // Se o banco falhar, o limitador deixa a requisicao passar (falha aberta): sem banco a API inteira ja esta fora do ar
  // e um erro aqui nao pode derrubar tudo. O erro fica registrado no log.
  async increment(chave) {
    try {
      const { rows } = await this.banco.query(
        `INSERT INTO rate_limits (chave, hits, expira_em)
         VALUES ($1, 1, now() + ($2::int * interval '1 millisecond'))
         ON CONFLICT (chave) DO UPDATE SET
           hits = CASE WHEN rate_limits.expira_em <= now() THEN 1 ELSE rate_limits.hits + 1 END,
           expira_em = CASE WHEN rate_limits.expira_em <= now() THEN now() + ($2::int * interval '1 millisecond') ELSE rate_limits.expira_em END
         RETURNING hits, expira_em`,
        [chave, this.windowMs]
      );
      if (Math.floor(Math.random() * LIMPEZA_UMA_EM) === 0) {
        this.banco.query("DELETE FROM rate_limits WHERE expira_em < now() - interval '1 hour'").catch(() => {});
      }
      return { totalHits: rows[0].hits, resetTime: new Date(rows[0].expira_em) };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[rate-limit] falha ao contar (deixando passar):", err.message);
      return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
    }
  }

  async decrement(chave) {
    try {
      await this.banco.query("UPDATE rate_limits SET hits = GREATEST(hits - 1, 0) WHERE chave = $1", [chave]);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[rate-limit] falha ao descontar:", err.message);
    }
  }

  async resetKey(chave) {
    try {
      await this.banco.query("DELETE FROM rate_limits WHERE chave = $1", [chave]);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[rate-limit] falha ao zerar:", err.message);
    }
  }
}

module.exports = PgStore;
