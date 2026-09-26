-- Padroniza o titulo dos quizzes por nivel: "Quiz de Python — Médio" passa a "Quiz de Python (Médio)".
-- So' altera os titulos que terminam exatamente com o travessao e o nome do nivel (nao mexe no que o administrador editou).
UPDATE quizzes
   SET titulo = regexp_replace(titulo, ' — (Fácil|Médio|Difícil)$', ' (\1)')
 WHERE titulo ~ ' — (Fácil|Médio|Difícil)$';
