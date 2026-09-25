-- Os icones das areas passam de emoji para o NOME de um icone SVG do site (frontend/js/icons.js).
-- So' atualiza as areas do catalogo original; categorias criadas pelo administrador ficam como estao
-- (o site mostra o icone padrao "code" quando o nome nao existe).
UPDATE categorias
   SET icone = CASE slug
    WHEN 'logica-de-programacao' THEN 'flow'
    WHEN 'python' THEN 'python'
    WHEN 'javascript' THEN 'braces'
    WHEN 'java' THEN 'cup'
    WHEN 'c-e-cpp' THEN 'pointer'
    WHEN 'csharp-dotnet' THEN 'hex-hash'
    WHEN 'html-e-css' THEN 'browser'
    WHEN 'backend-e-apis' THEN 'server'
    WHEN 'desenvolvimento-mobile' THEN 'phone'
    WHEN 'git-e-github' THEN 'branch'
    WHEN 'estruturas-de-dados' THEN 'tree'
    WHEN 'engenharia-de-software' THEN 'checklist'
    WHEN 'desenvolvimento-de-jogos' THEN 'gamepad'
    WHEN 'banco-de-dados-e-sql' THEN 'database'
    WHEN 'ciencia-de-dados' THEN 'chart'
    WHEN 'inteligencia-artificial' THEN 'robot'
    WHEN 'machine-learning' THEN 'neural'
    WHEN 'redes-de-computadores' THEN 'globe'
    WHEN 'sistemas-operacionais-linux' THEN 'terminal'
    WHEN 'cloud-computing' THEN 'cloud'
    WHEN 'devops-e-containers' THEN 'container'
    WHEN 'hardware-e-arquitetura' THEN 'chip'
    WHEN 'iot-e-eletronica' THEN 'wifi'
    WHEN 'seguranca-da-informacao' THEN 'shield'
    WHEN 'criptografia-e-blockchain' THEN 'lock'
    WHEN 'ux-ui-design' THEN 'layout'
    WHEN 'gestao-de-projetos-ageis' THEN 'kanban'
    WHEN 'governanca-ti-lgpd' THEN 'scale'
    WHEN 'empreendedorismo-e-startups' THEN 'rocket'
    WHEN 'suporte-e-informatica-basica' THEN 'monitor'
    WHEN 'matematica-para-computacao' THEN 'math'
    WHEN 'tecnologias-emergentes' THEN 'atom'
   END
 WHERE slug IN ('logica-de-programacao', 'python', 'javascript', 'java', 'c-e-cpp', 'csharp-dotnet', 'html-e-css', 'backend-e-apis', 'desenvolvimento-mobile', 'git-e-github', 'estruturas-de-dados', 'engenharia-de-software', 'desenvolvimento-de-jogos', 'banco-de-dados-e-sql', 'ciencia-de-dados', 'inteligencia-artificial', 'machine-learning', 'redes-de-computadores', 'sistemas-operacionais-linux', 'cloud-computing', 'devops-e-containers', 'hardware-e-arquitetura', 'iot-e-eletronica', 'seguranca-da-informacao', 'criptografia-e-blockchain', 'ux-ui-design', 'gestao-de-projetos-ageis', 'governanca-ti-lgpd', 'empreendedorismo-e-startups', 'suporte-e-informatica-basica', 'matematica-para-computacao', 'tecnologias-emergentes');
