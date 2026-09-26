// Versão atual do QUIZ TECH e o histórico do que mudou em cada uma, em linguagem simples (sem jargão).
// É a MESMA fonte para três lugares: o aviso "Nova versão disponível" (o que mudou), o cartão "Novidades" (Meu perfil e Ajuda)
// e o número no rodapé. Ao mudar qualquer coisa que a pessoa vê ou faz, siga o passo a passo de CONTRIBUINDO.md:
// suba a versão aqui, acrescente a entrada NO TOPO do histórico, e faça o mesmo em CHANGELOG.md e em backend-node/package.json.
// Os testes (backend-node/tests/infra.test.js) reprovam se essas coisas ficarem diferentes entre si.

export const APP_VERSION = "2.4.0";

export const CHANGELOG = [
  {
    versao: "2.4.0",
    data: "2026-09-26",
    mudancas: [
      "Tutorial de boas-vindas no primeiro acesso, tour guiado em cada página e botão “?” de ajuda em todas as telas",
      "Nova Central de Ajuda e textos explicativos em todas as páginas (quizzes, resultado, ranking, perfil e certificado)",
      "Funciona melhor em tablet e TV: letras grandes, navegação pelas setas do controle remoto e teclas A a F para responder o quiz",
      "Novo cartão “Novidades” e aviso de atualização que mostra o que mudou",
      "Mais rápido: o site e o banco de dados saíram do computador do dono e as respostas caíram de cerca de 2 segundos para 0,15 segundo",
      "A logo redonda das telas de entrada e do certificado não é mais cortada",
    ],
  },
  {
    versao: "2.3.0",
    data: "2026-09-25",
    mudancas: [
      "Três níveis em cada área (Fácil, Médio e Difícil): agora são 96 quizzes e 576 perguntas, e cada nível dá o seu certificado",
      "Ranking da semana e do mês, além do geral, com filtro por nível",
      "QR Code no certificado, para qualquer pessoa conferir que ele é verdadeiro",
      "Recuperação de senha por e-mail (“Esqueci minha senha”)",
      "Painel do administrador para criar e editar quizzes, áreas e usuários",
    ],
  },
  {
    versao: "2.2.0",
    data: "2026-09-25",
    mudancas: ["Endereço fixo e gratuito para acessar o QUIZ TECH, que não muda quando o servidor reinicia"],
  },
  {
    versao: "2.1.0",
    data: "2026-09-25",
    mudancas: ["Ícones novos e nítidos em todo o site, um para cada área de tecnologia, iguais em qualquer aparelho"],
  },
  {
    versao: "2.0.0",
    data: "2026-09-25",
    mudancas: [
      "Instale o QUIZ TECH como aplicativo no celular (botão “Instalar app”, com passo a passo para cada navegador)",
      "Site reconstruído por dentro: mais seguro e preparado para abrir mesmo sem internet",
    ],
  },
  {
    versao: "1.1.0",
    data: "2026-09-25",
    mudancas: [
      "Certificado de conclusão com código de verificação para quem acerta 70% ou mais",
      "Política de privacidade e opção de excluir a própria conta",
      "Aviso de nova versão quando o site é atualizado",
      "Novo visual com as cores da logo",
    ],
  },
  {
    versao: "1.0.0",
    data: "2026-09-24",
    mudancas: ["Primeira versão: 32 áreas de tecnologia com quizzes, cadastro, login, pontuação e ranking"],
  },
];
