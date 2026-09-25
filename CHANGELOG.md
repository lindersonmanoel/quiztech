# Histórico de versões

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e [versionamento semântico](https://semver.org/lang/pt-BR/).
A versão em execução aparece no rodapé do site e em `/api/version`.

## [2.0.0] - 2026-09-25

Reescrita do backend em **Node.js**, no mesmo padrão do Meu Bolso Digital. As rotas da API continuam as mesmas; o site
segue funcionando (mudou só o formato das mensagens de erro: `{ "erro", "campos" }`).

### Adicionado
- **Instalar como aplicativo (PWA):** botão "Instalar app" para todos os navegadores Android, com instalação nativa quando o
  navegador oferece e passo a passo específico (Chrome, Edge, Firefox, Samsung Internet, Opera, Brave, DuckDuckGo, Vivaldi)
  ou aviso para abrir fora de navegadores embutidos (Instagram, Facebook...). Manifesto, ícones, atalhos e abertura offline.
- Backend Express em camadas (rotas → controladores → serviços → models) com PostgreSQL, migrações `.sql` e 73 testes.
- Publicação no esquema do Meu Bolso: API em contêiner na VM, banco no **mesmo servidor PostgreSQL** (banco e usuário
  próprios, isolados), Cloudflare Tunnel, backup diário, CI de testes, segurança semanal e fumaça diária de produção.
- `DEPLOY.md` e `SEGURANCA.md`.
- Endereço da API configurável no site (`frontend/js/config.js`), para o site (Vercel) e a API (VM) ficarem em endereços diferentes.

### Alterado
- O site no Vercel é só estático; a API roda na VM. `vercel.json` sem função serverless.
- A API escuta na porta 3100 (a 3000 é do Meu Bolso Digital).
- O e-mail do administrador continua definido por `ADMIN_EMAIL`; agora o limite de tentativas usa o IP real do visitante
  vindo do Cloudflare (`CLIENT_IP_HEADER`), que o cliente não consegue forjar.

### Removido
- Backend Python/FastAPI, função serverless do Vercel e Alembic (o código antigo fica em `backend/` e `api/` só como referência).

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

1. Altere `version` em `backend-node/package.json` e descreva as mudanças aqui.
2. Faça o commit e o push na branch `main`. O Vercel publica o site; na VM: `git pull` e `docker compose ... up -d --build` (DEPLOY.md).
3. Opcional: crie a etiqueta da versão: `git tag v2.0.0 && git push --tags`.
4. Quem estiver com o site aberto verá o aviso de nova versão em até 5 minutos.
