# Sprint 21.5 - BI de Turmas e Ocupação

Endpoint administrativo read-only `GET /api/admin/bi/classes`, protegido por `requireAuth` e `canManageSystem`. Frontend em `/admin/bi/turmas`.

## Fontes e fórmulas

- Turma, capacidade, status, professor, unidade, modalidade, dias e horários: `j12_turmas`.
- Ocupação válida por turma: `COUNT(DISTINCT enrollment_class_links.enrollment_id)` para vínculo `ACTIVE`, `unlinked_at IS NULL`, matrícula `EnrollmentStatus.ACTIVE` e `deleted_at IS NULL`.
- Alunos matriculados: `COUNT(DISTINCT enrollments.student_person_id)` no mesmo escopo canônico, sem duplicar a Pessoa entre turmas ou matrículas.
- Taxa de ocupação: soma da ocupação das turmas com capacidade válida / soma de suas capacidades × 100.
- Vagas: `MAX(capacidade - ocupação, 0)`, somente para capacidade maior que zero.
- Lotada: ocupação maior ou igual à capacidade válida.
- Subutilizada: ocupação inferior a 50% da capacidade válida.

Capacidade nula ou zero não é inventada, não entra em capacidade total/taxa/vagas e permanece visível na tabela como indisponível. Categoria não existe canonicamente em `j12_turmas` e é explicitamente indisponível. O período compartilhado é aceito por compatibilidade, mas as métricas são snapshot atual; não existe reconstrução histórica de ocupação.

O repository executa duas consultas agregadas independentes em paralelo, parametrizadas e read-only, sem N+1. Múltiplos vínculos ou joins não duplicam matrículas ou Pessoas por causa de `COUNT(DISTINCT ...)`. A Sprint não cria migrations nem inicia a 21.6.
