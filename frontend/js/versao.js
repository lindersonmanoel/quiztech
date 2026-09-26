// Versão atual do QUIZ TECH e o histórico do que mudou em cada uma, em linguagem simples (sem jargão).
// É a MESMA fonte para três lugares: o aviso "Nova versão disponível" (o que mudou), o cartão "Novidades" (Meu perfil e Ajuda)
// e o número no rodapé. Ao mudar qualquer coisa que a pessoa vê ou faz, siga o passo a passo de CONTRIBUINDO.md:
// suba a versão aqui, acrescente a entrada NO TOPO do histórico, e faça o mesmo em CHANGELOG.md e em backend-node/package.json.
// Os testes (backend-node/tests/infra.test.js) reprovam se essas coisas ficarem diferentes entre si.

export const APP_VERSION = "2.4.2";

export const CHANGELOG = [
  {
    versao: "2.4.2",
    data: "2026-09-26",
    mudancas: [
      "Correção do enquadramento no celular: o menu passou a exibir todos os itens (o botão Cadastrar ficava cortado) e a página não ultrapassa mais a largura da tela",
    ],
  },
  {
    versao: "2.4.1",
    data: "2026-09-26",
    mudancas: [
      "Revisão da linguagem: todos os textos do site passaram a adotar tom formal, com correção ortográfica e remoção de travessões",
      "Títulos dos quizzes padronizados por nível, por exemplo “Quiz de Python (Médio)”",
    ],
  },
  {
    versao: "2.4.0",
    data: "2026-09-26",
    mudancas: [
      "Tutorial de boas-vindas no primeiro acesso, tour guiado em cada página e botão “?” de ajuda em todas as telas",
      "Nova Central de Ajuda e textos explicativos em todas as páginas (quizzes, resultado, ranking, perfil e certificado)",
      "Melhor funcionamento em tablet e TV: letras ampliadas, navegação pelas setas do controle remoto e teclas A a F para responder ao quiz",
      "Novo cartão “Novidades” e aviso de atualização com o resumo das alterações",
      "Maior velocidade: o site e o banco de dados passaram a operar em servidores em nuvem, e o tempo de resposta caiu de cerca de 2 segundos para 0,15 segundo",
      "Correção do corte da logo circular nas telas de entrada e no certificado",
    ],
  },
  {
    versao: "2.3.0",
    data: "2026-09-25",
    mudancas: [
      "Três níveis em cada área (Fácil, Médio e Difícil): são 96 quizzes e 576 perguntas, e cada nível gera o seu próprio certificado",
      "Ranking semanal e mensal, além do geral, com filtro por nível",
      "QR Code no certificado, que permite a qualquer pessoa verificar a sua autenticidade",
      "Recuperação de senha por e-mail (“Esqueci minha senha”)",
      "Painel do administrador para criar e editar quizzes, áreas e usuários",
    ],
  },
  {
    versao: "2.2.0",
    data: "2026-09-25",
    mudancas: ["Endereço fixo e gratuito para acesso ao QUIZ TECH, que não se altera quando o servidor é reiniciado"],
  },
  {
    versao: "2.1.0",
    data: "2026-09-25",
    mudancas: ["Novos ícones em todo o site, um para cada área de tecnologia, com a mesma aparência em qualquer aparelho"],
  },
  {
    versao: "2.0.0",
    data: "2026-09-25",
    mudancas: [
      "Instalação do QUIZ TECH como aplicativo no celular (botão “Instalar app”, com instruções para cada navegador)",
      "Reestruturação interna do site: maior segurança e abertura das telas mesmo sem conexão",
    ],
  },
  {
    versao: "1.1.0",
    data: "2026-09-25",
    mudancas: [
      "Certificado de conclusão, com código de verificação, para quem obtém 70% ou mais de acertos",
      "Política de privacidade e opção de exclusão da própria conta",
      "Aviso de nova versão quando o site é atualizado",
      "Novo visual, com as cores da logomarca",
    ],
  },
  {
    versao: "1.0.0",
    data: "2026-09-24",
    mudancas: ["Primeira versão: 32 áreas de tecnologia com quizzes, cadastro, acesso, pontuação e ranking"],
  },
];
