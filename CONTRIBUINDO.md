# Como manter o QUIZ TECH em dia

O site se explica em vários lugares (tutorial, tour de cada página, Central de Ajuda, novidades, README). Para todos dizerem
a **mesma coisa que o site faz hoje**, cada mudança passa por este checklist. Os testes em
`backend-node/tests/infra.test.js` reprovam o que puder ser verificado automaticamente.

## Onde ficam as descrições

| O quê | Onde | Quem confere |
|---|---|---|
| Descrição da página (busca, prévia de link) | `<meta name="description">` em cada `frontend/*.html` | teste: existe, é única e tem 40 a 160 caracteres |
| Texto explicativo de cada página | caixas "Como usar…" (`.dica`) nas páginas e em `frontend/js/*.js` | revisão |
| Tutorial de boas-vindas e tour de cada página | `BOAS_VINDAS` e `TOURS` em `frontend/js/tutorial.js` | teste E2E do tutorial (roda até o fim em celular, tablet e TV) |
| Central de Ajuda | `frontend/ajuda.html` | revisão; o teste confere que as seções existem |
| Versão e "o que mudou" | `frontend/js/versao.js` (`APP_VERSION` + `CHANGELOG`) | teste: versão = primeira do histórico = `CHANGELOG.md` = `backend-node/package.json` = nome do cache do service worker |
| Aviso "Nova versão disponível" | `frontend/js/app.js` (lê o histórico atualizado do servidor) | aparece quando o site é atualizado (service worker novo) ou a API muda |
| Lista de funcionalidades | `README.md` | revisão no pull request (checklist) |

## Ao mudar uma funcionalidade

1. Ajuste a **meta description** da página e os **textos explicativos** se o que ela faz mudou.
2. Ajuste o **passo do tour** dessa página (`TOURS` em `frontend/js/tutorial.js`) e, se for algo central, a Central de Ajuda.
3. **Suba a versão** (`2.4.0` → `2.4.1` para ajuste; `2.5.0` para funcionalidade nova) em **quatro lugares**:
   - `frontend/js/versao.js`: `APP_VERSION` e uma entrada **no topo** do `CHANGELOG`, com data e 1 a 6 frases claras, sem jargão;
   - `CHANGELOG.md`: uma seção `## [x.y.z] - AAAA-MM-DD` no topo;
   - `backend-node/package.json` (e o `package-lock.json`): `version`;
   - `frontend/service-worker.js`: `const CACHE = "quiztech-shell-vX.Y.Z"`. É a mudança nesse arquivo que faz o navegador de quem já usa
     o site (inclusive o app instalado) perceber a atualização e mostrar o aviso com o que mudou.
4. Atualize o **README** se for algo novo ou que mudou de comportamento.
5. Rode os testes (`cd backend-node && npm test`) e abra o pull request: o modelo já traz o checklist.
6. `git push` na `main`: o Vercel publica o site sozinho (e o GitHub Actions publica a API, se os segredos estiverem configurados: `DEPLOY.md`, seção 0).

## Página nova

Crie o `.html` (com `<meta name="description">`, `js/config.js` e o manifesto) e o `.js` dela, coloque os dois em `ARQUIVOS` do
`service-worker.js`, acrescente o link no menu (`frontend/js/app.js`, função `renderNav`), um passo em `TOURS` se fizer sentido
e uma seção na Ajuda. Sem isso os testes reprovam.

## Antes de publicar

- Endereço da API mudou? Atualize `frontend/js/config.js` **e** o `connect-src` em `vercel.json`.
- Mudou o banco? Nova migração em `database/migrations/` (nunca edite as antigas).
- Nenhuma credencial, chave ou `.env` no commit: o hook `pre-commit` (`bash scripts/instalar-hooks.sh`) e o CI conferem.
- Veja também `SEGURANCA.md` e `DEPLOY.md`.
