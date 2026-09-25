from .dados_infra import AREAS as _DADOS_INFRA
from .desenvolvimento import AREAS as _DEV
from .seguranca_gestao import AREAS as _SEG_GESTAO

ALL_AREAS = _DEV + _DADOS_INFRA + _SEG_GESTAO

# Pontos por posição da pergunta: 2 fáceis, 2 médias, 2 difíceis.
POINTS_BY_POSITION = [10, 10, 20, 20, 30, 30]
QUIZ_TIME_LIMIT = 300  # segundos
