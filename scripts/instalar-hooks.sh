#!/usr/bin/env bash
# Liga as travas do repositorio (pasta .githooks): o commit e' bloqueado se houver segredo. Rode uma vez: bash scripts/instalar-hooks.sh
cd "$(git rev-parse --show-toplevel)" || exit 1
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit 2>/dev/null || true
echo "Travas ativadas (core.hooksPath = .githooks)."
