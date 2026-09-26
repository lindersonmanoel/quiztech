-- 2.4.0: contadores do limite de tentativas no banco.
-- Em hospedagem sem servidor (Vercel) cada requisicao pode cair numa instancia diferente da API, entao um contador
-- em memoria nao limitaria nada. Aqui todas as instancias compartilham o mesmo contador.
-- A chave ja vem como hash (nao guarda IP nem e-mail em claro).
CREATE UNLOGGED TABLE rate_limits (
  chave      CHAR(64)    PRIMARY KEY,
  hits       INTEGER     NOT NULL,
  expira_em  TIMESTAMPTZ NOT NULL
);
CREATE INDEX rate_limits_expira_idx ON rate_limits (expira_em);
