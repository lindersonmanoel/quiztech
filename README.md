# QUIZ TECH

Plataforma web de quizzes de tecnologia com **certificado de conclusão**.

- **Frontend:** HTML5, CSS3 e JavaScript (sem framework, sem build)
- **Backend:** Python + FastAPI (API REST)
- **Banco:** PostgreSQL em produção, SQLite no desenvolvimento
- **Hospedagem:** Railway (um único serviço: a API também serve o frontend)

## O que já funciona

- Cadastro, login (JWT) e edição do nome exibido no certificado
- **32 áreas** de tecnologia e correlatas, cada uma com um quiz de 6 perguntas (2 fáceis, 2 médias, 2 difíceis)
- Quiz com cronômetro, navegação entre perguntas e correção **no servidor** (o gabarito nunca vai ao navegador antes de responder)
- Resultado com revisão pergunta a pergunta
- **Certificado de conclusão** emitido automaticamente com 70% ou mais de acertos, uma vez por quiz, com código de verificação público e página para imprimir ou salvar em PDF
- Ranking geral e por área (soma da melhor nota em cada quiz)
- API administrativa para criar/editar/remover categorias, quizzes e perguntas

### Áreas

| Grupo | Áreas |
|---|---|
| Desenvolvimento | Lógica de Programação, Python, JavaScript, Java, C e C++, C# e .NET, HTML e CSS, Back-end e APIs, Desenvolvimento Mobile, Git e GitHub, Estruturas de Dados e Algoritmos, Engenharia de Software e Testes, Desenvolvimento de Jogos |
| Dados e IA | Banco de Dados e SQL, Ciência de Dados e Analytics, Inteligência Artificial, Machine Learning |
| Infraestrutura | Redes, Sistemas Operacionais e Linux, Cloud Computing, DevOps e Containers, Hardware e Arquitetura, IoT e Eletrônica |
| Segurança e Criptografia | Segurança da Informação, Criptografia e Blockchain |
| Design e Produto | UX/UI Design |
| Gestão e Negócios | Gestão de Projetos e Métodos Ágeis, Governança de TI/ITIL/LGPD, Empreendedorismo e Startups |
| Fundamentos e Suporte | Suporte Técnico e Informática Básica, Matemática para Computação, Tecnologias Emergentes |

Para adicionar áreas ou perguntas, edite os arquivos em `backend/app/seed_data/`. Áreas novas (por `slug`) são criadas na próxima inicialização, sem apagar nada.

## Rodando localmente

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
copy .env.example .env        # opcional; defina ADMIN_EMAIL para virar administrador
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Abra http://127.0.0.1:8000 (site) ou http://127.0.0.1:8000/docs (documentação interativa da API).
No primeiro início o banco SQLite (`quiztech.db`) é criado e populado sozinho.

### Testes

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest
```

## Publicando no Railway

1. Suba este repositório no GitHub.
2. No Railway: **New Project → Deploy from GitHub repo** e escolha o repositório. O `Dockerfile` e o `railway.json` da raiz já configuram build e healthcheck (`/api/health`).
3. No mesmo projeto: **New → Database → PostgreSQL**.
4. No serviço da aplicação, aba **Variables**:

   | Variável | Valor |
   |---|---|
   | `SECRET_KEY` | uma chave aleatória longa: `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (referência ao banco do projeto) |
   | `ADMIN_EMAIL` | o e-mail com o qual você vai se cadastrar como administrador |

   Sem `SECRET_KEY` a aplicação recusa iniciar em produção, de propósito.
5. Em **Settings → Networking**, clique em **Generate Domain**.
6. Cadastre-se no site com o e-mail definido em `ADMIN_EMAIL` para ter acesso às rotas `/api/admin/*`.

## Estrutura

```
quiz-tech/
├── backend/
│   ├── app/
│   │   ├── main.py            # app FastAPI, cabeçalhos de segurança, serve o frontend
│   │   ├── models.py          # users, categories, quizzes, questions, alternatives, results, certificates
│   │   ├── routers/           # auth, quizzes (+ correção), results (+ ranking, certificados), admin
│   │   ├── seed.py            # carga idempotente das áreas
│   │   └── seed_data/         # conteúdo das 32 áreas
│   └── tests/
├── frontend/
│   ├── *.html                 # início, login, cadastro, quizzes, quiz, resultado, ranking, perfil, certificado
│   ├── css/style.css
│   ├── js/                    # um módulo por página + app.js (API, sessão, helpers)
│   └── assets/logo/
├── Dockerfile
└── railway.json
```

## Segurança

- Senhas com hash **bcrypt**; nunca guardadas em texto puro
- JWT assinado; `SECRET_KEY` obrigatória em produção
- Limite de tentativas de login (5 falhas em 15 min por IP + e-mail)
- Gabarito só é enviado depois da correção; a nota é calculada no servidor
- Rotas `/api/admin/*` exigem administrador
- Consulta pública de certificado por código **não expõe e-mail**
- O frontend insere conteúdo sempre com `textContent` (sem `innerHTML`), evitando XSS
- Cabeçalhos `X-Content-Type-Options`, `X-Frame-Options` e `Referrer-Policy`

## Próximos passos possíveis

Painel administrativo em HTML, recuperação de senha por e-mail, PWA, ranking semanal/mensal, mais de um quiz por área (níveis fácil/médio/difícil) e QR Code no certificado.
