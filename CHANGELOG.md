# Histórico de versões

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e [versionamento semântico](https://semver.org/lang/pt-BR/).
A versão do site aparece no rodapé; a do servidor, em `/api/version`.

## [2.4.2] - 2026-09-26

### Corrigido
- **Celular**: o menu quebra em linhas e mostra todos os itens (o botão "Cadastrar" ficava cortado na lateral), sem rolagem lateral, e deixa de ser fixo no topo.

## [2.4.1] - 2026-09-26

### Alterado
- **Revisão de linguagem em todo o site**: textos em tom formal, correção ortográfica conferida com dicionário do português e remoção de todos os
  travessões (títulos das páginas passam a usar "Página | QUIZ TECH"). Mensagens da API e e-mails também foram revisados.
- Títulos dos quizzes por nível: "Quiz de Python — Médio" passa a "Quiz de Python (Médio)" (migração `006_titulos_sem_travessao.sql`).

## [2.4.0] - 2026-09-26

Hospedagem sem depender de computador, tutorial e ajuda, suporte a tablet e TV, e novidades/aviso de atualização com o resumo do que mudou.

- **Novidades e aviso de atualização** (no molde do Meu Bolso Digital): `frontend/js/versao.js` (`APP_VERSION` + `CHANGELOG`) alimenta o aviso "Nova versão disponível" (com o que mudou, lido do servidor), o cartão "Novidades" (Meu perfil e Ajuda) e o número do rodapé. O aviso dispara quando o site é atualizado (service worker novo) ou quando a API muda. Testes conferem que versão, histórico, CHANGELOG.md, package.json e cache do service worker batem; meta description em todas as páginas. Checklist em `CONTRIBUINDO.md`.
- **Tutorial e ajuda**: boas-vindas em 6 telas no primeiro acesso, tour guiado por página (destaca cada elemento), botão "?" em todas as telas, Central de Ajuda (`ajuda.html`) e caixas explicativas em quizzes, quiz, resultado, ranking, perfil e certificado. O progresso do tutorial fica no aparelho.
- **Todos os aparelhos**: layout para celular (menu rolável, deitado), tablet (vertical/horizontal), monitores grandes e TV (letras grandes, foco visível, setas do controle remoto, botão Voltar; `?tv=1` força o modo). Atalhos A–F / 1–6 no quiz. Manifesto sem travar a orientação.

- Publicação da API pelo GitHub Actions (`publicar-api.yml`: migrações no Neon + deploy no Vercel) usando só Secrets do GitHub; hook `pre-commit` e novos padrões em `verificar-segredos.sh` (Neon, Tailscale, tokens do Cloudflare).

### Alterado
- **API no Vercel (gru1) + banco no Neon (sa-east-1)**: tudo em São Paulo, ~0,11–0,16 s por chamada, sem depender de computador ligado e sem
  o Supabase. `DATABASE_SSL_VERIFY` valida o certificado de bancos com CA pública. Railway (`x-real-ip`, seção 5e) segue documentado como alternativa;
  lá a carga inicial estoura o tempo de verificação por causa da distância até o banco (rode-a da sua máquina).
- **A API e o banco saíram do computador do dono.** O PostgreSQL agora é um banco gerenciado no **Supabase** (São Paulo) e a API
  roda como função no **Vercel** (`https://quiztech-api.vercel.app`, região gru1). O site chama esse endereço. Cada chamada à API
  caiu de ~1,4–2,2 s (Tailscale Funnel + PC de casa) para ~0,12–0,16 s.
- Contadores do limite de tentativas (login, cadastro, recuperação de senha) passam a ficar no PostgreSQL (tabela `rate_limits`,
  migração 004): com funções sem servidor, um contador em memória seria por instância e não limitaria nada. Falha aberta se o banco
  cair. Padrão continua "memória" fora do Vercel (`RATE_LIMIT_STORE`).
- Envio de e-mail em segundo plano com `waitUntil` (`utils/segundoPlano.js`), para terminar mesmo depois da resposta.
- Migração 005: segurança por linha (RLS) ligada em todas as tabelas, sem políticas, e privilégios de `anon`/`authenticated`
  revogados, pois o Supabase expõe o schema `public` por uma API própria que este projeto não usa.
- `scripts/empacotar-api-vercel.js` gera o pacote da função (`dist-api/`); `/api/integridade` (protegida por senha) confere por SHA-1
  que o publicado é exatamente o enviado.

## [2.3.0] - 2026-09-25

### Adicionado
- **Painel administrativo** (`admin.html`, link "Painel" só para administradores): resumo (totais, movimento dos últimos 7 dias,
  taxa de aprovação, áreas mais feitas e últimos resultados), gestão de **quizzes** (criar, editar, ativar/desativar, excluir;
  editor de perguntas e alternativas), **áreas** e **usuários** (busca, promover/rebaixar administrador; ninguém altera o
  próprio acesso). Novas rotas `/api/admin`: `activity`, `quizzes` (lista e detalhe com o gabarito), `questions/:id` (PUT), `users`.
- **Recuperação de senha por e-mail**: "Esqueci minha senha" gera um link de uso único (só o hash SHA-256 vai ao banco; o token
  viaja no fragmento `#` da URL, que não chega a servidores nem ao Referer). Vale 60 min, um novo pedido invalida o anterior,
  trocar a senha encerra as sessões abertas e avisa por e-mail. Resposta idêntica exista a conta ou não; limites por IP e por
  e-mail. Configuração SMTP em `.env.production` (veja DEPLOY.md); sem SMTP a tela avisa que o recurso está desativado.
- **Ranking semanal e mensal** (`/api/ranking?period=week|month|all`, também `difficulty=`): semana de segunda a domingo e mês
  do calendário, no fuso do Brasil (`RANKING_TZ`). O site tem abas Geral / Este mês / Esta semana e filtro por nível.
- **Três níveis por área** (fácil, médio e difícil): +64 quizzes e +384 perguntas (96 quizzes e 576 perguntas no total). O quiz
  atual vira "— Médio". Fácil vale 60 pontos, médio 120 e difícil 180 no ranking. Cada nível rende um certificado próprio, e
  a lista de quizzes marca os níveis já certificados. A carga é idempotente e um quiz apagado pelo administrador não volta.
- **QR Code no certificado** (`/api/certificates/:codigo/qr.svg`) que abre a página pública de verificação, e nível no certificado.
- PWA: novas páginas no cache offline (`quiztech-shell-v4`) e atalho "Ranking da semana".
- `/api/config` público informa se a recuperação de senha está ativa.

### Corrigido
- O atributo `hidden` agora sempre esconde (abas e botões com `display` definido por classe apareciam mesmo escondidos).

## [2.2.0] - 2026-09-25

### Adicionado
- **Endereço público fixo e gratuito, sem domínio próprio, com o Tailscale Funnel** (`https://quiztech.<rede>.ts.net`): contêiner
  `quiztech-tailscale` no `docker-compose.prod.yml` (perfil `funnel`). O endereço não muda quando o Docker reinicia e o login
  fica guardado em volume. Scripts `scripts/tailscale-entrar.ps1` (entrada por chave, sem link) e `scripts/endereco-publico.ps1`.

### Alterado
- O site (Vercel) passa a chamar a API pelo endereço do Funnel; a CSP e o teste de fumaça de produção também.
- `CLIENT_IP_HEADER` fica vazio por padrão: com o Funnel a API usa o IP resolvido pelo proxy (testado: o limite de login não é
  burlado por cabeçalhos de IP forjados).

## [2.1.0] - 2026-09-25

### Alterado
- **Todos os ícones do site agora são SVG** (nada de emoji): 32 pictogramas, um por área de tecnologia, mais os ícones de
  interface (instalar, certo/errado, troféu do ranking, menu). Herdam a cor do texto, ficam nítidos em qualquer tela e
  não dependem das fontes de emoji de cada aparelho. Os passos de instalação do PWA também usam os ícones SVG do menu.
- Marca do QUIZ TECH em SVG (`assets/logo/marca.svg`) na barra, no rodapé, no favicon e no manifesto do aplicativo; os
  colchetes decorativos `< />` também são SVG.
- As áreas guardam no banco o **nome do ícone** (por exemplo `python`, `database`) em vez do emoji; a migração `002`
  converte as áreas existentes. Categorias criadas pelo administrador que usem um nome desconhecido mostram o ícone padrão.
- 4 testes novos (77 no total).

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

1. Siga o checklist de `CONTRIBUINDO.md`: mesma versão em `backend-node/package.json`, `frontend/js/versao.js` (`APP_VERSION` + entrada no topo do histórico), nome do cache em `frontend/service-worker.js` e uma seção aqui. Os testes conferem.
2. Faça o commit e o push na branch `main`. O Vercel publica o site; na VM: `git pull` e `docker compose ... up -d --build` (DEPLOY.md).
3. Opcional: crie a etiqueta da versão: `git tag v2.0.0 && git push --tags`.
4. Quem estiver com o site aberto verá o aviso de nova versão em até 5 minutos.
