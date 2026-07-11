# Sprint 22.6 — Homologação do Portal do Professor

Data: 2026-07-11. Branch `sprint-22`, base `ec2c91bd1f239b68b96206043510bcad6ecbd2c2`. O working tree inicial estava limpo. Foram lidos os artefatos das Sprints 22.1 a 22.5. Nenhuma migration, escrita deliberada em banco compartilhado, integração externa, commit, push ou tag foi executada.

## Matriz funcional

| Área                      | Backend real                               | Frontend real                      | Estado          |
| ------------------------- | ------------------------------------------ | ---------------------------------- | --------------- |
| Autenticação              | `requireAuth` e escopo derivado da sessão  | rota protegida para `professor`    | completo local  |
| Perfil                    | GET/PUT `/professor/me/profile`            | sem tela dedicada                  | parcial         |
| Dashboard                 | GET `/professor/me/dashboard`              | redireciona para presenças         | parcial         |
| Turmas atribuídas         | GET `/professor/me/turmas`                 | seletor da chamada                 | completo local  |
| Alunos da turma           | GET `/professor/me/turmas/:turmaId/alunos` | lista da chamada                   | completo local  |
| Agenda/horários           | GET `/professor/me/agenda`                 | sem tela dedicada                  | parcial         |
| Chamada/presença          | GET/POST `/professor/me/presencas`         | registro presente/falta            | completo local  |
| Atualização de presença   | POST idempotente por aluno/turma/data      | salva novamente a chamada          | completo local  |
| Histórico de frequência   | consulta por data no backend               | sem seletor histórico dedicado     | parcial         |
| Avaliações                | GET/POST `/professor/me/avaliacoes`        | inexistente                        | parcial/backend |
| Ocorrências/eventos       | GET/POST `/professor/me/ocorrencias`       | inexistente                        | parcial/backend |
| Planejamentos             | GET/POST/PUT `/professor/me/planejamentos` | inexistente                        | parcial/backend |
| Comunicação               | GET/POST `/professor/me/comunicacao`       | inexistente                        | parcial/backend |
| Notificações/preferências | dashboard e settings do professor          | centro genérico, sem tela dedicada | parcial         |

Não foram inventadas páginas para capacidades que hoje existem somente no backend.

## Bugs corrigidos

1. O frontend consultava rotas administrativas amplas de turmas/alunos e a rota genérica de presença. Agora usa somente `/professor/me/*`.
2. A chamada aceitava um `alunoId` arbitrário dentro de uma turma autorizada. Cada registro agora precisa pertencer à lista real da turma antes de qualquer `INSERT` ou `UPDATE`.
3. Avaliações e ocorrências aceitavam aluno fora da turma. O vínculo aluno/turma/professor agora é obrigatório.
4. Status de agenda por `agendaItemId` podia ser alterado sem resolver a turma. O backend carrega `class_id`, comprova a turma do professor e restringe o `UPDATE` por item e turma.
5. Upsert de planejamento aceitava ID pertencente a outro professor. O owner é verificado e acesso cruzado retorna 403.

## Segurança

- Professor não escolhe seu próprio `professorId`; o backend usa `teacherId`/`professor_id` autenticado.
- Professor sem vínculo recebe 403.
- Turma não atribuída é rejeitada antes de carregar alunos ou escrever presença.
- Aluno fora da turma é rejeitado com 403 antes da mutation.
- Agenda, avaliação, ocorrência, planejamento e comunicação reutilizam o escopo do professor no backend.
- Admin e coordenador mantêm a capacidade existente de abrir um professor explicitamente.

## Limites e bloqueios

- Não houve browser E2E porque a automação de navegador não foi disponibilizada nesta execução.
- O banco configurado é externo; os testes não executaram mutations reais do portal. Homologação integrada exige clone/HML isolado.
- O schema do Portal do Professor ainda é garantido por DDL no bootstrap do serviço, não por um ledger de migration comprovado.
- `tsc --noEmit` possui oito erros preexistentes em arquivos de Campeonatos, fora do escopo 22.6.
- Perfil, agenda, avaliações, ocorrências, planejamento e comunicação não possuem telas dedicadas e não podem ser classificados como completos.
