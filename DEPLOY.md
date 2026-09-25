# Deploy (VM com Docker + Cloudflare Tunnel + site no Vercel)

Mesmo esquema do Meu Bolso Digital: o **site** (pasta `frontend/`) fica no Vercel; a **API** roda em contêiner na sua VM e
usa o **mesmo servidor PostgreSQL** do Meu Bolso Digital, em um banco e com um usuário próprios; o acesso de fora é pelo
**Cloudflare Tunnel** (nenhuma porta aberta no firewall).

```
  Celular / PC ──HTTPS──> Vercel (site estático + PWA)
        │
        └──HTTPS (CORS)──> Cloudflare ──> Tunnel ──> quiztech-api-prod (Node, 127.0.0.1:3100)
                                                          │  rede Docker "meubolsodigital_default"
                                                          └──> meu-bolso-digital-db-prod (PostgreSQL)
                                                                 ├─ banco meu_bolso_digital  (usuário mbd)      ← Meu Bolso
                                                                 └─ banco quiztech           (usuário quiztech) ← QUIZ TECH
```

Os dois projetos **não enxergam os dados um do outro**: o usuário `quiztech` só entra no banco `quiztech`
(no banco do Meu Bolso ele recebe *permission denied*).

## 1. Pré-requisitos
- Docker Desktop (ou Docker Engine) na VM, com o contêiner `meu-bolso-digital-db-prod` de pé.
- Conta no Vercel e (para endereço fixo) uma conta Cloudflare com um domínio.

## 2. Criar o `.env.production`
```bash
cp .env.production.example .env.production
```
Preencha (o arquivo nunca vai para o Git):
- `QUIZTECH_DB_PASSWORD` e a senha dentro de `DATABASE_URL`: **a mesma**, forte e só sua
  (`node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`).
- `JWT_SECRET`: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
- `FRONTEND_URL`: o endereço do site no Vercel (e o domínio próprio, separados por vírgula). É a lista do CORS.
- `ADMIN_EMAIL`: o e-mail que vai virar administrador (cadastre-se com ele logo depois de subir).
- `DB_HOST` e `REDE_DO_BANCO`: nome do contêiner do Postgres e da rede Docker dele (`docker ps`, `docker network ls`).

## 3. Criar o banco do QUIZ TECH no Postgres compartilhado (uma vez)
```bash
QUIZTECH_DB_PASSWORD='a-mesma-senha-do-.env.production' sh scripts/setup-banco-compartilhado.sh
```
O script cria o usuário `quiztech` e o banco `quiztech` e **só acrescenta**: não lê, altera nem apaga nada do banco do
Meu Bolso Digital. Pode rodar de novo (só atualiza a senha).

## 4. Subir a API
```bash
export GIT_COMMIT=$(git rev-parse --short HEAD)      # PowerShell: $env:GIT_COMMIT = (git rev-parse --short HEAD)
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```
Sobem: `quiztech-api-prod` (API) e `quiztech-backup-prod` (backup diário). Na primeira vez a API aplica as migrações e
carrega as 32 áreas sozinha (veja `docker logs quiztech-api-prod`). Confira: `curl http://127.0.0.1:3100/api/health/ready`.

## 5. Endereço público da API
### 5a. Demonstração (sem conta e sem domínio)
Em `.env.production` use `SERVE_FRONTEND=1` e suba com o perfil `demo`:
```bash
docker compose --env-file .env.production -f docker-compose.prod.yml --profile demo up -d
docker logs quiztech-demo-tunnel 2>&1 | grep trycloudflare
```
O endereço `https://<aleatório>.trycloudflare.com` serve o site **e** a API juntos. Ele muda a cada reinício: só para testes.

Para descobrir o endereço **atual** (e copiá-lo para a área de transferência), na raiz do projeto:
```powershell
powershell -File scripts\endereco-publico.ps1
```
Sem domínio próprio não há como fixar esse endereço: o túnel gratuito da Cloudflare não garante o mesmo nome nem tempo no ar.
Ele muda sempre que o túnel ou o Docker reinicia (os contêineres voltam sozinhos, mas com um endereço novo). Por isso **não instale
o app no celular a partir dele**: o aplicativo instalado fica preso ao endereço antigo. Espere o endereço fixo (5b).

### 5c. Endereço fixo e GRATUITO, sem domínio próprio (Tailscale Funnel) — recomendado sem domínio
Dá um endereço `https://quiztech.<sua-rede>.ts.net` que **não muda** quando o Docker ou a máquina reiniciam. O contêiner
`quiztech-tailscale` entra na sua conta do Tailscale e publica a API (e o site) na internet, com HTTPS automático.

1. Crie uma conta gratuita em tailscale.com (login com Google/Microsoft/GitHub).
2. Em **Settings → Keys → Generate auth key**, gere uma chave de autenticação (`tskey-auth-…`). Ela vale só para o primeiro login.
3. Grave-a sem deixar rastro no histórico: `powershell -File scripts	ailscale-entrar.ps1` e cole a chave no campo oculto
   (ou preencha `TS_AUTHKEY=` no `.env.production` e rode `docker compose --env-file .env.production -f docker-compose.prod.yml --profile funnel up -d tailscale`).
4. Na primeira vez o Tailscale mostra no log (`docker logs quiztech-tailscale`) um link para **liberar o Funnel** na sua rede:
   abra-o e clique em *Enable Funnel*. O HTTPS e o Funnel precisam estar ativos no painel (*DNS → HTTPS Certificates*).
5. Confira: `docker exec quiztech-tailscale tailscale --socket=/tmp/tailscaled.sock funnel status` deve mostrar
   `https://quiztech.<sua-rede>.ts.net (Funnel on)`.
6. **Depois do primeiro login, deixe `TS_AUTHKEY=` vazio** e recrie o contêiner (`… up -d --force-recreate tailscale`): o login fica
   guardado no volume `tailscale_state` e sobrevive a reinícios.
7. Deixe `CLIENT_IP_HEADER=` **vazio** no `.env.production` (com o Funnel a API usa o IP resolvido pelo proxy; se ele estivesse
   preenchido, um visitante poderia forjar o cabeçalho e burlar o limite de tentativas de login) e pare o túnel de demonstração
   (`docker compose … --profile demo stop demo-tunnel`).
8. No site (Vercel), o endereço da API já aponta para o Funnel: `frontend/js/config.js` (`API_PRODUCAO`) e `vercel.json`
   (`connect-src` da CSP). Se o seu for outro, troque nos dois e faça commit.

Observações:
- O nome demora alguns minutos para aparecer no DNS público logo depois de ligar o Funnel; alguns provedores demoram mais.
  Se o seu computador não resolver o nome, teste por outro DNS (por exemplo o do celular em dados móveis).
- O limite gratuito do Tailscale é folgado para este projeto (tráfego de Funnel tem teto de banda, sem custo por requisição).
- A chave de API (`tskey-api-…`) dá controle total da rede: **nunca a cole em chat nem em arquivo do projeto**; revogue-a depois de usar.

### 5b. Endereço fixo (Cloudflare Tunnel nomeado)
1. Painel da Cloudflare → **Zero Trust → Networks → Tunnels → Create a tunnel** (tipo *Cloudflared*), nome `quiztech-api`.
2. Copie o valor depois de `--token` e cole em `CLOUDFLARE_TUNNEL_TOKEN` no `.env.production`.
3. Em **Public Hostname**: subdomínio `api.quiztech`, domínio `lumvix.com.br` (ou o seu), *Service* `HTTP`,
   URL `quiztech-api-prod:3100` (nome do contêiner + porta, não `localhost`).
4. Suba o túnel: `docker compose --env-file .env.production -f docker-compose.prod.yml --profile tunnel up -d`.
5. Coloque `SERVE_FRONTEND=0` no `.env.production` e `docker compose ... up -d` de novo.

## 6. Site no Vercel
1. Vercel → **Add New → Project** → repositório `lindersonmanoel/quiztech`. O `vercel.json` já define: sem build, pasta
   `frontend/` como site, cabeçalhos de segurança e a política de conteúdo (CSP).
2. Se o endereço da API for diferente de `https://api.quiztech.lumvix.com.br`, troque-o em **dois** lugares e faça
   commit: `frontend/js/config.js` (`API_PRODUCAO`) e `vercel.json` (`connect-src` na CSP).
3. **Settings → Deployment Protection**: deixe a produção pública (*Only Preview Deployments*).
4. O domínio do site aponta para o Vercel (Settings → Domains); coloque esse domínio em `FRONTEND_URL` e rode
   `docker compose ... up -d` para a API liberar o CORS dele.

## 7. Conferir
```bash
FRONTEND_URL=https://seu-site API_URL=https://api.seu-dominio node scripts/smoke-producao.js
```
Confere site, manifesto PWA, CSP, saúde da API/banco, CORS (libera o site, bloqueia o resto) e rotas protegidas.
O GitHub roda o mesmo teste todo dia (`.github/workflows/smoke-producao.yml`).

## 8. Atualizações futuras
```bash
git pull
export GIT_COMMIT=$(git rev-parse --short HEAD)
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```
As migrações e a carga inicial rodam sozinhas na partida (idempotentes). O Vercel publica o site a cada `git push` na `main`.
Quem estiver com o site aberto vê o aviso "Nova versão disponível" em até 5 minutos.

## Backup automático do banco
O serviço `backup` gera, todo dia, um dump comprimido em **`./backups`** (`quiztech-AAAA-MM-DD-HHMMSS.dump`), confere que
ele abre e apaga os com mais de 14 dias (`BACKUP_KEEP_DAYS`). O primeiro sai 1 minuto depois de subir.

> **O backup fica na mesma máquina do banco.** Copie `backups/` para fora dela (outro disco, nuvem) com frequência.
> Se a máquina se perder, o backup local se perde junto. `backups/` e `*.dump` estão no `.gitignore`.

- Ver se funciona: `docker logs quiztech-backup-prod` (`[backup] OK: ...`).
- Gerar um agora: `docker compose --env-file .env.production -f docker-compose.prod.yml run --rm -e BACKUP_ONCE=1 backup`.
- **Restaurar em um banco de TESTE** (nunca por cima da produção sem necessidade):
  ```bash
  docker exec meu-bolso-digital-db-prod createdb -U mbd -O quiztech quiztech_teste
  docker exec -i meu-bolso-digital-db-prod pg_restore -U quiztech -d quiztech_teste --no-owner < backups/quiztech-AAAA-MM-DD-HHMMSS.dump
  ```
  (o `pg_restore` autentica pelo socket local dentro do contêiner; para apagar o teste: `dropdb -U mbd quiztech_teste`).

## Solução de problemas
| Sintoma | Causa provável |
|---|---|
| O site abre mas as áreas não carregam; no console, erro de CORS | O endereço do site não está em `FRONTEND_URL` (ou `config.js`/CSP apontam para outro endereço da API). Corrija e rode `up -d`. |
| `403` em `js/*.js` e fontes num endereço `trycloudflare` | Versão antiga da API (antes de 2.0.0): atualize. |
| Túnel com erro 502/1033 | A API não está saudável (`docker ps`) ou a URL do Public Hostname não é `quiztech-api-prod:3100`. |
| A API não sobe: "Faltam variáveis de ambiente" | `DATABASE_URL`, `JWT_SECRET` ou `FRONTEND_URL` vazios no `.env.production`. |
| `network meubolsodigital_default not found` | O Postgres compartilhado não está rodando ou a rede tem outro nome: ajuste `REDE_DO_BANCO`. |
| Todos os logins dão "Muitas tentativas" | O limite por IP está vendo o IP do túnel: confira `CLIENT_IP_HEADER=cf-connecting-ip` no `.env.production`. |
