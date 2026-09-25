#!/bin/sh
# Cria, no servidor PostgreSQL que JA roda para o Meu Bolso Digital, um usuario e um banco PROPRIOS do QUIZ TECH.
# So' ACRESCENTA: nao le, altera nem apaga nada do banco do Meu Bolso Digital. E' idempotente (pode rodar de novo:
# so' atualiza a senha do usuario).
#
# Uso (Git Bash / Linux / macOS), na raiz do projeto:
#   QUIZTECH_DB_PASSWORD='a-mesma-senha-do-.env.production' sh scripts/setup-banco-compartilhado.sh
#   (opcional) 1o argumento = nome do contêiner do Postgres; 2o = superusuario dele.
#
# A conexao usa o socket LOCAL dentro do contêiner (docker exec), que nao pede a senha do superusuario, entao
# este script nunca precisa saber a senha do Meu Bolso Digital.
set -eu

CONTAINER="${1:-meu-bolso-digital-db-prod}"
SUPERUSUARIO="${2:-mbd}"
ROLE="quiztech"
BANCO="quiztech"

if [ -z "${QUIZTECH_DB_PASSWORD:-}" ]; then
  echo "Defina QUIZTECH_DB_PASSWORD (a senha do usuario '$ROLE', igual a do .env.production)." >&2
  exit 1
fi

psql_exec() { docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$SUPERUSUARIO" -d postgres "$@"; }

# 1) usuario (cria ou atualiza a senha). A senha entra como variavel do psql (:'senha'): nunca colada no SQL.
existe_role=$(psql_exec -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$ROLE'")
if [ "$existe_role" = "1" ]; then
  printf "ALTER ROLE %s WITH LOGIN PASSWORD :'senha';\n" "$ROLE" | psql_exec -v senha="$QUIZTECH_DB_PASSWORD" >/dev/null
  echo "usuario '$ROLE': senha atualizada."
else
  printf "CREATE ROLE %s WITH LOGIN PASSWORD :'senha' NOSUPERUSER NOCREATEDB NOCREATEROLE;\n" "$ROLE" | psql_exec -v senha="$QUIZTECH_DB_PASSWORD" >/dev/null
  echo "usuario '$ROLE': criado."
fi

# 2) banco proprio, com o usuario acima como dono
existe_db=$(psql_exec -tAc "SELECT 1 FROM pg_database WHERE datname = '$BANCO'")
if [ "$existe_db" != "1" ]; then
  psql_exec -c "CREATE DATABASE $BANCO OWNER $ROLE ENCODING 'UTF8'" >/dev/null
  echo "banco '$BANCO': criado."
else
  echo "banco '$BANCO': ja existia."
fi

# 3) so' o dono entra no banco novo (ninguem mais, alem do superusuario)
psql_exec -c "REVOKE ALL ON DATABASE $BANCO FROM PUBLIC" >/dev/null
echo "pronto. Confira: docker exec $CONTAINER psql -U $SUPERUSUARIO -d postgres -tAc \"SELECT datname FROM pg_database\""
