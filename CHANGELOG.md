# Histórico de versões

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e [versionamento semântico](https://semver.org/lang/pt-BR/).
A versão em execução aparece no rodapé do site e em `/api/version`.

## [1.1.0] - 2026-09-25

### Adicionado
- Certificado de conclusão emitido com 70% ou mais de acertos, com código de verificação público.
- Política de privacidade, consentimento no cadastro e exclusão da própria conta (LGPD).
- Versão e commit no rodapé, rota `/api/version` e aviso "Nova versão disponível" para quem está com o site aberto.
- Execução em VM com Docker Compose (PostgreSQL, HTTPS opcional com Caddy e túnel Cloudflare).
- Migrações de banco com Alembic; CI com testes, `pip-audit` e `bandit`; notificação de deploy no Slack.
- Novo visual com as cores e a identidade da logo; logo redonda e centralizada no login e no cadastro.

### Alterado
- O gabarito só é mostrado a quem foi aprovado; há intervalo de 10 minutos para refazer um quiz reprovado.
- O ranking público mostra só o primeiro nome e a inicial do último sobrenome.
- `/docs` e `/openapi.json` ficam desligados em produção.

### Segurança
- Limite de tentativas de login por IP e por e-mail (persistido no banco) e limite de cadastros por IP.
- O IP do visitante só é lido de cabeçalhos escritos por proxy confiável.
- Dependências de teste atualizadas (pytest 9.x, PYSEC-2026-1845).

## [1.0.0] - 2026-09-24

### Adicionado
- Primeira versão: 32 áreas de tecnologia com quizzes, cadastro e login, pontuação, ranking e API administrativa.

## Como publicar uma nova versão

1. Altere `__version__` em `backend/app/version.py` e descreva as mudanças aqui.
2. Faça o commit e o push na branch `main`. O Vercel publica em produção.
3. Opcional: crie a etiqueta da versão: `git tag v1.1.0 && git push --tags`.
4. Quem estiver com o site aberto verá o aviso de nova versão em até 5 minutos.
