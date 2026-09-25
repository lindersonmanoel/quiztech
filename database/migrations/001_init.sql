-- Esquema inicial do QUIZ TECH.

CREATE TABLE usuarios (
  id             SERIAL PRIMARY KEY,
  nome           VARCHAR(120) NOT NULL,
  email          VARCHAR(160) NOT NULL,
  senha_hash     VARCHAR(100) NOT NULL,
  is_admin       BOOLEAN      NOT NULL DEFAULT false,
  -- Trocar/redefinir a senha incrementa e invalida os tokens (JWT) emitidos antes.
  token_version  INTEGER      NOT NULL DEFAULT 0,
  criado_em      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  atualizado_em  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
-- E-mail unico sem diferenciar maiusculas de minusculas.
CREATE UNIQUE INDEX usuarios_email_unico ON usuarios (lower(email));

CREATE TABLE categorias (
  id         SERIAL PRIMARY KEY,
  nome       VARCHAR(80)  NOT NULL UNIQUE,
  slug       VARCHAR(80)  NOT NULL UNIQUE,
  grupo      VARCHAR(60)  NOT NULL,
  icone      VARCHAR(16)  NOT NULL DEFAULT '',
  descricao  TEXT         NOT NULL DEFAULT ''
);
CREATE INDEX categorias_grupo_idx ON categorias (grupo);

CREATE TABLE quizzes (
  id            SERIAL PRIMARY KEY,
  titulo        VARCHAR(120) NOT NULL,
  descricao     TEXT         NOT NULL DEFAULT '',
  categoria_id  INTEGER      NOT NULL REFERENCES categorias (id) ON DELETE CASCADE,
  dificuldade   VARCHAR(10)  NOT NULL DEFAULT 'media' CHECK (dificuldade IN ('facil', 'media', 'dificil')),
  -- Segundos; 0 = sem limite.
  limite_tempo  INTEGER      NOT NULL DEFAULT 0 CHECK (limite_tempo >= 0),
  ativo         BOOLEAN      NOT NULL DEFAULT true,
  criado_em     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX quizzes_categoria_idx ON quizzes (categoria_id);

CREATE TABLE perguntas (
  id       SERIAL PRIMARY KEY,
  quiz_id  INTEGER NOT NULL REFERENCES quizzes (id) ON DELETE CASCADE,
  texto    TEXT    NOT NULL,
  pontos   INTEGER NOT NULL DEFAULT 10 CHECK (pontos BETWEEN 1 AND 100),
  posicao  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX perguntas_quiz_idx ON perguntas (quiz_id, posicao);

CREATE TABLE alternativas (
  id           SERIAL PRIMARY KEY,
  pergunta_id  INTEGER NOT NULL REFERENCES perguntas (id) ON DELETE CASCADE,
  texto        TEXT    NOT NULL,
  correta      BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX alternativas_pergunta_idx ON alternativas (pergunta_id);
-- O banco garante: no maximo UMA alternativa correta por pergunta.
CREATE UNIQUE INDEX alternativas_uma_correta ON alternativas (pergunta_id) WHERE correta;

CREATE TABLE resultados (
  id              SERIAL PRIMARY KEY,
  usuario_id      INTEGER      NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  quiz_id         INTEGER      NOT NULL REFERENCES quizzes (id) ON DELETE RESTRICT,
  pontos          INTEGER      NOT NULL,
  pontos_maximos  INTEGER      NOT NULL,
  acertos         INTEGER      NOT NULL,
  erros           INTEGER      NOT NULL,
  percentual      NUMERIC(5,1) NOT NULL,
  tempo_gasto     INTEGER      NOT NULL DEFAULT 0,
  -- Revisao pergunta a pergunta (com o gabarito); so' vai ao usuario depois da aprovacao.
  revisao         JSONB        NOT NULL DEFAULT '[]'::jsonb,
  criado_em       TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX resultados_usuario_quiz_idx ON resultados (usuario_id, quiz_id, criado_em DESC);
CREATE INDEX resultados_quiz_idx ON resultados (quiz_id);

-- Certificado de conclusao: emitido uma vez por usuario e quiz, na primeira aprovacao.
CREATE TABLE certificados (
  id            SERIAL PRIMARY KEY,
  codigo        VARCHAR(20)  NOT NULL UNIQUE,
  usuario_id    INTEGER      NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  quiz_id       INTEGER      NOT NULL REFERENCES quizzes (id) ON DELETE RESTRICT,
  resultado_id  INTEGER      NOT NULL REFERENCES resultados (id) ON DELETE CASCADE,
  pontos        INTEGER      NOT NULL,
  percentual    NUMERIC(5,1) NOT NULL,
  emitido_em    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, quiz_id)
);
