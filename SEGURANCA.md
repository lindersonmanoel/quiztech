# Revisão de segurança periódica

Este roteiro mantém o QUIZ TECH seguro depois de publicado. O que dá para automatizar já roda sozinho; o resto é uma
revisão curta, uma vez por mês.

## O que já roda sozinho
| O quê | Quando | Onde |
|---|---|---|
| 73 testes do backend (autenticação, certificado, ranking, CORS, limites de tentativa) | a cada push e pull request | `.github/workflows/ci.yml` |
| Auditoria de dependências (`npm audit`): reprova se houver falha **alta/crítica** | toda segunda-feira e quando `package*.json` muda | `.github/workflows/seguranca.yml` |
| Procura de segredos versionados (`scripts/verificar-segredos.sh`) | idem | idem |
| Teste de fumaça em produção (site, API, CORS, CSP, PWA) | todo dia | `.github/workflows/smoke-producao.yml` |
| PRs de atualização de dependências, Docker e Actions | toda semana | `.github/dependabot.yml` |
| Backup do banco | todo dia | contêiner `quiztech-backup-prod` |

Se algum desses falhar, o GitHub avisa por e-mail: trate como prioridade.

## Revisão mensal (30 min)
1. **Dependências:** abra os PRs do Dependabot; leia o changelog, rode os testes e faça o merge. `npm audit --omit=dev` limpo?
2. **Backup:** existe um arquivo recente em `backups/`? **Restaure um em banco de teste** (DEPLOY.md) e confira que abre. Copie `backups/` para fora da VM.
3. **Logs:** `docker logs quiztech-api-prod --since 720h | grep -E "429|401|erro"`: picos de tentativas de login? Erros novos?
4. **Contas:** só o(s) e-mail(s) esperados são administradores? (`SELECT email FROM usuarios WHERE is_admin;` no banco `quiztech`).
5. **Acessos:** quem tem acesso à VM, ao Vercel, à Cloudflare, ao GitHub? Remova o que não for mais necessário (ative 2FA em todos).
6. **Certificados e perguntas:** o conteúdo continua correto? Uma pergunta errada emite certificado errado.

## A cada 6 meses (ou quando alguém sai do projeto)
- Troque `JWT_SECRET` (todos precisam entrar de novo) e a senha do usuário `quiztech` no Postgres
  (`QUIZTECH_DB_PASSWORD=... sh scripts/setup-banco-compartilhado.sh` e atualize o `.env.production`).
- Regenere o token do Cloudflare Tunnel se alguém que o conhecia saiu.
- Revise a política de privacidade (`frontend/privacidade.html`) com um profissional; ela é um modelo.

## Checklist para toda nova rota ou funcionalidade
- [ ] Exige login (`requireAuth`)? Admin (`requireAdmin`)? A resposta só traz dados do próprio usuário?
- [ ] Valida **todo** dado de entrada em `utils/validators.js` (tipo, tamanho, faixa) e usa `idDaRota`/`inteiroOpcional` nos ids?
- [ ] Consulta SQL só com parâmetros (`$1`, `$2`), nunca concatenando texto do usuário?
- [ ] A resposta de erro não vaza SQL, caminho de arquivo nem stack trace? (o `errorHandler` cuida disso; não contorne)
- [ ] Rota que testa senha ou envia algo em massa tem limitador (`middleware/limiters.js`)?
- [ ] Nunca devolve o gabarito antes de o usuário ser aprovado?
- [ ] Tem teste (inclusive o caso de ataque: sem login, de outro usuário, dado inválido)?
- [ ] Conteúdo do usuário entra na tela com `textContent` (nunca `innerHTML`)?

## Se algo der errado (suspeita de vazamento ou conta invadida)
1. **Contenha:** troque `JWT_SECRET` no `.env.production` e `docker compose ... up -d` (derruba todas as sessões).
2. Troque a senha do usuário `quiztech` no Postgres e o token do Cloudflare Tunnel; revogue chaves expostas.
3. Veja os logs (`docker logs quiztech-api-prod`) e o que mudou (`git log`, `SELECT ... FROM usuarios WHERE is_admin`).
4. Se houve vazamento de dados pessoais, avise as pessoas afetadas e a ANPD (LGPD, art. 48).
5. Registre o que houve e a correção (um item em `CHANGELOG.md`).

## Boas práticas de segredos
- Segredos só em `.env.production` (na VM) e nas *Secrets* do GitHub/Vercel. **Nunca** em código, issue ou mensagem.
- O `.env*` real não vai para o Git (`.gitignore`); só os `.example`. O `verificar-segredos.sh` confere isso.
- Uma senha/chave diferente para cada coisa (banco, JWT, túnel). Nada compartilhado com o Meu Bolso Digital.
- O banco compartilhado é isolado por usuário: se um dia precisar de mais isolamento, suba um Postgres só para o QUIZ TECH
  (`docker-compose.local.yml` mostra como) e aponte o `DATABASE_URL` para ele.
