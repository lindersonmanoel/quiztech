# QUIZ TECH

**🔗 Link principal do projeto: https://quiztech.vercel.app**

Plataforma web de quizzes de tecnologia com **certificado de conclusão**, instalável como aplicativo (PWA).

- **Site:** HTML5, CSS3 e JavaScript (sem framework e sem build), na pasta `frontend/`, publicado no **Vercel**.
- **API:** Node.js + Express (`backend-node/`), no mesmo molde do backend do Meu Bolso Digital; em produção roda no Railway (contêiner Docker).
- **Banco:** PostgreSQL. Em produção, no **Railway** (mesmo projeto da API, rede interna); em Docker local, o mesmo servidor do Meu Bolso Digital.
- **Publicação:** o site roda no **Vercel** e a API + PostgreSQL no **Railway**, como o Meu Bolso Digital: nada depende do computador do dono (veja [DEPLOY.md](DEPLOY.md), seção 5e). Continua possível rodar em Docker numa VM própria (seções anteriores). CI no GitHub.

## O que já funciona
- Cadastro, login (JWT) e edição do nome exibido no certificado.
- **32 áreas** de tecnologia e correlatas, cada uma com **3 níveis** (fácil, médio e difícil) de 6 perguntas: 96 quizzes e 576 perguntas.
- Quiz com cronômetro; a correção é **no servidor** (o gabarito nunca vai ao navegador antes de responder).
- **Certificado de conclusão** com 70% ou mais (5 de 6), uma vez por quiz, com código de verificação público e página para
  imprimir/salvar em PDF. O gabarito só aparece para quem foi aprovado; há 10 minutos de espera para refazer um quiz reprovado.
- Ranking **geral, mensal e semanal**, por área e por nível, mostrando só "Primeiro nome + inicial".
- **QR Code no certificado** para conferir a autenticidade.
- **Recuperação de senha por e-mail** (link de uso único; veja DEPLOY.md, seção de e-mail).
- **LGPD:** política de privacidade, consentimento no cadastro e exclusão da própria conta.
- **PWA:** botão **"Instalar app"** para todos os navegadores Android (instalação nativa no Chrome, Edge, Samsung Internet,
  Opera, Brave...; passo a passo no Firefox e afins) e abertura offline da "casca" do app.
- **Painel administrativo** em HTML (`/admin.html`): resumo, quizzes e perguntas, áreas e usuários.
- Versão e commit no rodapé e aviso de "Nova versão disponível".
- **Ícones 100% SVG**: um pictograma por área, ícones de interface e a marca do QUIZ TECH, todos vetoriais e na cor do texto (`frontend/js/icons.js`).

## Estrutura
```
quiz-tech/
├── backend-node/            # API (Express) — mesmo padrão do Meu Bolso Digital
│   ├── src/  app.js  config.js  server.js  version.js
│   │   ├── routes/ controllers/ services/ models/   # rotas → controladores → regras → SQL
│   │   ├── middleware/      # auth, limitadores de tentativa, tratamento de erros
│   │   ├── database/        # pool, migrate.js, seed.js
│   │   └── utils/           # validadores, erros, senha (bcrypt nativo), IP do visitante
│   └── tests/               # Jest + Supertest em PostgreSQL de verdade (73 testes)
├── database/
│   ├── migrations/          # 001_init.sql ... (aplicadas em ordem, registradas em _migrations)
│   └── seed/areas.json      # as 32 áreas, quizzes e perguntas
├── frontend/                # site + PWA (manifest, service worker, ícones SVG em js/icons.js e assets/)
├── scripts/                 # backup diário, criação do banco compartilhado, fumaça de produção, busca de segredos
├── .github/workflows/       # testes, segurança semanal, fumaça diária, aviso de deploy no Slack
├── Dockerfile  docker-compose.prod.yml  docker-compose.local.yml
├── DEPLOY.md  SEGURANCA.md  CHANGELOG.md
└── vercel.json
```
> As pastas `backend/` e `api/` (mais `requirements.txt`) são o **backend antigo em Python**, substituído pelo `backend-node/`.
> Ficam apenas como referência até você decidir removê-las; o Vercel e o Docker já as ignoram.

## Rodando localmente

**Opção A: tudo em Docker** (sem instalar nada além do Docker Desktop):
```powershell
copy .env.local.example .env.local      # preencha as 3 variáveis
docker compose --env-file .env.local -f docker-compose.local.yml up -d --build
```
Abra http://localhost:3100 (a API serve o site).

**Opção B: Node no seu computador** (precisa de Node 18+ e um PostgreSQL):
```powershell
cd backend-node
npm install
copy .env.example .env                  # ajuste DATABASE_URL e JWT_SECRET
npm run migrate; npm run seed
npm run dev                             # API em http://localhost:3100
```
Sirva a pasta `frontend/` em `http://localhost:5500` (por exemplo `npx serve frontend -l 5500`) ou defina `SERVE_FRONTEND=1`
e abra a própria API. O `frontend/js/config.js` escolhe sozinho o endereço da API.

### Testes
Precisam de um PostgreSQL só para testes (os testes apagam usuários e resultados dele!):
```powershell
docker run -d --name qt-testdb -e POSTGRES_USER=quiztech_test -e POSTGRES_PASSWORD=teste -e POSTGRES_DB=quiztech_test -p 55432:5432 postgres:16-alpine
cd backend-node
copy .env.test.example .env.test
npm test
```

## Versão e avisos de atualização
- **Versão:** `backend-node/package.json` (versionamento semântico; histórico em [CHANGELOG.md](CHANGELOG.md)). Aparece no rodapé
  (`v2.0.0 · abc1234`) e em `GET /api/version`. O commit vem do Vercel (`VERCEL_GIT_COMMIT_SHA`) ou do build Docker (`GIT_COMMIT`).
- **Aviso dentro do site:** com o site aberto, ele confere `/api/version` a cada 5 minutos e quando a aba volta ao foco; se
  a versão mudou, mostra "Nova versão disponível" (durante um quiz o botão de recarregar não aparece).
- **Aviso de deploy no Slack:** `.github/workflows/notify-deploy.yml` avisa cada deploy do Vercel. Crie um *Incoming Webhook*
  no Slack e cadastre-o como segredo `SLACK_WEBHOOK_URL` (GitHub → Settings → Secrets and variables → Actions). Sem o segredo, não faz nada.

## Segurança
Veja [SEGURANCA.md](SEGURANCA.md) (rotina de revisão, checklist de novas rotas e o que fazer em caso de incidente). Em resumo:
senhas com bcrypt; JWT com versão (trocar a senha derruba sessões); correção no servidor; limite de tentativas de login
(por IP+e-mail e por e-mail), de cadastros e de exclusão de conta; CORS estrito; CSP sem script inline; nenhuma resposta de
erro vaza SQL; o banco impõe uma única alternativa correta por pergunta e um certificado por usuário e quiz.
