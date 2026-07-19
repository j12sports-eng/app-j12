# Sprint 29.1 — Matrícula → Turma

> Documento iniciado em 19/07/2026, após a auditoria read-only e antes de qualquer implementação. Os resultados finais foram acrescentados somente depois dos gates.

## 1. Objetivo

Consolidar uma operação interna, segura e idempotente para associar um Enrollment elegível a uma Turma, reutilizando o vínculo, as regras de capacidade e a transação existentes.

## 2. Contexto

O domínio `backend/src/domains/enrollments` já possuía persistência e concorrência para `Enrollment → Turma`. A Sprint não cria segunda fonte de verdade, não ativa Enrollment e não produz efeitos financeiros, contratuais, de agenda ou comunicação.

## 3. Branch e HEAD

- branch inicial: `sprint-23`;
- HEAD inicial: `b48941ce1f162cab616286c770c7af7cec94ce99`;
- commit anterior: `b48941c docs(auth): define unidade canonica e bloqueio de membership`.

## 4. Worktree inicial

Limpo, sem arquivos staged, modificados ou não rastreados.

## 5. Arquitetura auditada

Foram auditados integralmente Enrollments, Classes/Turmas, Alunos, services, facades, repositories, controllers, routes, migrations, catálogo de erros, auditoria, composição HTTP e testes relacionados. As buscas cobriram os nomes de vínculo, IDs, capacidade, estados, locks, transações, duplicate key e auditoria exigidos no roteiro.

## 6. Vínculo canônico encontrado

Aplica-se o cenário A. O vínculo oficial é `Enrollment ↔ Turma`, representado por `enrollment_class_links`. O legado `j12_alunos.turma_id`, `turma_principal` e JSONs não é escrito nem usado como segunda fonte no fluxo transacional.

## 7. Tabela e chaves

- tabela: `enrollment_class_links`;
- PK: `id VARCHAR(64)`;
- FK `enrollment_id → enrollments.id`;
- FK `class_id → j12_turmas.id`;
- unique `ux_enrollment_class_links_active(enrollment_id, class_id, status)`;
- índices individuais por Enrollment, turma e status.

## 8. Cardinalidade

O schema permite N:N: várias turmas por Enrollment e vários Enrollments por Turma, impedindo repetição do mesmo par/status. Não existe regra comprovada de turma única por Enrollment, modalidade ou unidade; nenhuma restrição hipotética foi criada.

## 9. Estados

- Enrollment: somente `ACTIVE` é elegível; `DRAFT` e demais estados são bloqueados;
- Turma: somente `ativa` é elegível;
- vínculo: `ACTIVE` ocupa vaga e `INACTIVE` não ocupa;
- histórico `INACTIVE` do mesmo par gera `ENROLLMENT_CLASS_LINK_STATE_CONFLICT`; não há reativação automática;
- lista de espera: inexistente.

## 10. Regra de elegibilidade

O Enrollment deve existir e estar `ACTIVE`. O aluno é derivado do Enrollment e não é aceito como identificador independente. A Turma deve existir e estar ativa. Não há regras comprovadas adicionais de idade, sexo, nível, professor, modalidade, período ou unidade no fluxo canônico.

## 11. Regra de capacidade

A capacidade oficial é `j12_turmas.capacidade`. Valor nulo, zero ou não positivo significa capacidade não configurada e bloqueia o vínculo; não significa ilimitada.

## 12. Regra de ocupação

Na operação transacional, a ocupação é `COUNT(DISTINCT enrollment_class_links.enrollment_id)` por turma para `status='ACTIVE' AND unlinked_at IS NULL`. Links inativos não ocupam vaga.

## 13. Estratégia de concorrência

O runner abre transação e a composição de Turmas executa `SELECT ... FOR UPDATE` em `j12_turmas`. Enrollment, vínculo, lock, capacidade, insert e revalidação usam a mesma conexão. A ocupação é validada antes e depois do insert; overbooking provoca rollback.

## 14. Estratégia de idempotência

O service relê o link ativo dentro da transação. O repository trata `ER_DUP_ENTRY` somente para o índice único auditado, relê o vencedor e retorna `created=false/reused=true`. O histórico incompatível é lido antes da criação e retorna conflito, sem sobrescrever ou reativar.

## 15. Transaction runner

Foi reutilizado `createMySqlEnrollmentClassLinkTransactionRunner`. A nova composição injeta `ClassFacade + MySqlClassRepository` sobre o mesmo `queryRunner` transacional dos repositories de Enrollment e class link. Commit, rollback e liberação de conexão continuam sob a infraestrutura existente.

## 16. Repository

`MySqlEnrollmentClassLinkRepository` foi reutilizado e recebeu somente a leitura necessária `findLatestByEnrollmentAndClass`. As leituras pontuais agora usam projeção explícita, parâmetros e `LIMIT 1`; não há SQL no Application Service nem acesso a tabelas de Alunos, Financeiro, Agenda ou Notificações.

## 17. Application Service

`EnrollmentClassLinkService.assignEnrollmentToClass(command, context)` é a fronteira canônica consolidada:

- allowlist estrita de `enrollmentId` e `classId`;
- ator obtido do contexto confiável;
- autorização injetada e fail-closed;
- aluno nunca aceito do cliente;
- delegação ao fluxo atômico existente;
- bloqueio de histórico incompatível;
- DTO mínimo, validado e imutável;
- preservação dos métodos anteriores por compatibilidade.

## 18. Facade/composição

`EnrollmentFacade` foi reutilizada e expõe `assignEnrollmentToClass`. `enrollment-class-link.composition.js` cria o service/facade canônicos e a ClassFacade transacional. Nenhuma facade paralela foi criada.

## 19. HTTP criado ou bloqueado

Bloqueado. A autorização atual é global e a Sprint 28 comprovou ausência de membership usuário–unidade. Nenhum endpoint, controller ou bypass global foi adicionado; `unitId` de body não é aceito.

## 20. Auditoria

`linked_at` e `linked_by` permanecem persistidos no vínculo. A fronteira registra tentativa, criação, reutilização, capacidade esgotada, conflito, rejeição/falha e duração, limitando o contexto a IDs, request/correlation ID e código. Payload, token, PII e dados financeiros não são logados.

## 21. Arquivos criados

- `backend/src/domains/enrollments/application/tests/enrollment-class-link.assignment.test.js`;
- `backend/src/domains/enrollments/infrastructure/enrollment-class-link.composition.js`;
- `backend/src/domains/enrollments/infrastructure/enrollment-class-link.composition.test.js`;
- `docs/BACKEND/SPRINT_29_1.md`.

## 22. Arquivos alterados

- `backend/src/domains/enrollments/application/facades/enrollment.facade.js`;
- `backend/src/domains/enrollments/application/services/enrollment-class-link.service.js`;
- `backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment-class-link.repository.js`;
- `backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment-class-link.repository.test.js`;
- `backend/src/domains/enrollments/infrastructure/index.js`;
- `backend/src/domains/enrollments/index.js`.

## 23. Migration criada ou reutilizada

Nenhuma migration foi criada. Foram reutilizadas as estruturas existentes de `j12_turmas` e `enrollment_class_links`, inclusive FKs e índice único.

## 24. Testes executados

- suíte dirigida Enrollment–Turma: 35/35;
- suíte backend oficial: 1.062/1.062;
- segurança: 34/34;
- migrations: 65/65.

A suíte completa descobriu e aprovou regressões de Enrollment, Turmas, Alunos, Pessoas, Agenda, CRM, repositories, transações, segurança e migrations.

## 25. Resultados

- ESLint dos arquivos da Sprint: aprovado, zero erros;
- ESLint amplo de Enrollments + Classes: 140 violações de Prettier preexistentes em arquivos fora do diff; nenhuma pertence aos arquivos da Sprint;
- Prettier/check dos arquivos da Sprint: aprovado;
- `npm run typecheck`: aprovado;
- `npm run build`: aprovado;
- `git diff --check`: aprovado;
- `npm run ci:secrets`: 2.318 arquivos, zero achados.

## 26. Bloqueios

- HTTP bloqueado por ausência de autorização contextual por unidade;
- o banco auditado não possui Enrollments nem class links, portanto não há jornada real representativa para executar;
- o migration runner não foi adotado no banco atual.

## 27. Riscos residuais

- o índice único permite somente um registro `INACTIVE` por par; ciclos futuros exigem fluxo explícito de transferência/reativação e possível evolução de schema;
- consultas legadas de Turmas ainda podem exibir ocupação por `j12_alunos`, diferente da operação canônica por class links;
- não há regra comprovada de compatibilidade por modalidade, faixa etária, nível, sexo ou unidade;
- a operação permanece somente interna até existir membership seguro.

## 28. Rollback

Reverter os seis arquivos preexistentes alterados e remover os quatro arquivos criados. Não há DDL, dado, endpoint, status de Enrollment, cobrança, contrato, agenda ou mensagem para desfazer.

## 29. Próximos passos

Homologar a operação com dados representativos e concorrência real após baseline do migration runner; definir fluxo separado para transferência/reativação; reconciliar a leitura legada de ocupação sem criar dupla escrita; manter HTTP desmontado até autorização por unidade.

## 30. Recomendação para Sprint 29.2

Priorizar o fluxo explícito de transferência/reativação e a convergência read-only da ocupação legada para `enrollment_class_links`. A montagem HTTP deve esperar a resolução da identidade autenticável e do membership usuário–unidade.

## Auditoria read-only do banco

Ambiente auditado: Percona Server 5.7.44-48.

- `enrollments`: 0 registros;
- `j12_turmas`: 7 registros, todos `ativa`;
- capacidades: todas positivas, entre 20 e 24;
- `enrollment_class_links`: 0 registros;
- FKs e índice único: presentes;
- duplicidades, órfãos e overbooking: zero.

O catálogo atual possui 24 migrations. `plan`, `up --dry-run` e `status` passaram e mostraram todas como `PENDING` porque o banco não possui ledger adotado. Nenhum `up`, DDL, DML ou alteração de dados foi executado.

## 31. Validacao retomada em 19/07/2026

Esta retomada preservou a implementacao ja existente e nao alterou rotas, endpoints, frontend, migrations, APIs publicas ou schema.

Resultados executados na retomada:

- suite dirigida Enrollment/Turma: 40/40 passou;
- `node --test`: falhou fora do escopo da Sprint 29.1 por teste frontend de CRM em `src/features/crm/tests/crm-sla-alerts.frontend.test.mjs`, que rejeita a string `refetchInterval`;
- `npm run build`: passou;
- `npm run typecheck`: passou;
- `npm exec prettier -- --check`: comando literal falhou por ausencia de alvo para o parser;
- `npm exec prettier -- --check .`: falhou por baseline amplo preexistente com 420 arquivos fora do escopo;
- Prettier dirigido aos arquivos da Sprint 29.1: passou;
- `git diff --check`: passou, com avisos LF/CRLF do Git no Windows;
- `npm run ci:secrets`: passou, 2.318 arquivos verificados e zero achados.
