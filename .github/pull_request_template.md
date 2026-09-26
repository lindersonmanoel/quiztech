## O que muda

<!-- Em uma ou duas frases: o que esta mudança faz e por quê. -->

## Checklist

- [ ] Rodei os testes: `cd backend-node && npm test` (o CI também roda).
- [ ] **Mudou algo que a pessoa vê ou faz?** Atualizei as descrições do site (detalhes em `CONTRIBUINDO.md`):
  - [ ] `<meta name="description">` e textos explicativos da página;
  - [ ] passo do tour em `frontend/js/tutorial.js` (e a Central de Ajuda, se for algo central);
  - [ ] **versão nova** em `frontend/js/versao.js` (`APP_VERSION` + entrada no topo), `CHANGELOG.md`, `backend-node/package.json` e no nome do cache de `frontend/service-worker.js`;
  - [ ] `README.md`, se a funcionalidade é nova.
- [ ] **Página nova?** Menu (`renderNav`), pré-cache no `service-worker.js`, `<meta name="description">`, passo no tour.
- [ ] **Banco?** Nova migração em `database/migrations/` (nunca editar as antigas); avisei se ela pode falhar em dados existentes.
- [ ] **Endereço da API mudou?** Atualizei `frontend/js/config.js` **e** o `connect-src` da CSP em `vercel.json`.
- [ ] Nenhuma credencial, chave ou `.env` no commit.

## Como verificar

<!-- Passos para testar na mão (ou "coberto pelos testes automatizados"). -->
