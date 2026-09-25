-- 2.3.0: recuperacao de senha por e-mail, controle da carga dos niveis e indice para o ranking por periodo.

-- Pedidos de redefinicao de senha. Guarda so' o HASH (SHA-256) do token: quem ler o banco nao consegue usar o link.
CREATE TABLE senha_resets (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER     NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  token_hash  CHAR(64)    NOT NULL UNIQUE,
  expira_em   TIMESTAMPTZ NOT NULL,
  usado_em    TIMESTAMPTZ,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX senha_resets_usuario_idx ON senha_resets (usuario_id);

-- Registra quais quizzes de nivel (facil/dificil) do catalogo ja foram criados. Assim, se o administrador
-- apagar ou desativar um deles, a carga inicial nao o recria toda vez que a API sobe.
CREATE TABLE seed_niveis (
  chave      VARCHAR(120) PRIMARY KEY, -- "<slug-da-area>:<dificuldade>"
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- O ranking semanal/mensal filtra os resultados pela data.
CREATE INDEX resultados_criado_idx ON resultados (criado_em);
