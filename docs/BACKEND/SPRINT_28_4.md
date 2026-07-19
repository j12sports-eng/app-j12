# Sprint 28.4 — Modelo canônico de unidade e membership usuário–unidade

> Documento iniciado em 19/07/2026 antes de qualquer implementação de runtime. A auditoria determinou bloqueio seguro para o membership; os resultados finais de validação foram acrescentados após a execução dos gates.

## 1. Objetivo

Definir a unidade operacional canônica e somente implementar membership usuário–unidade quando identidade, FKs, status, autorização contextual, transporte e migration runner puderem ser comprovados sem fallback inseguro.

## 2. Contexto

As Sprints 28.1 e 28.2 consolidaram pré-matrícula como `Enrollment DRAFT` e prepararam a composição interna. A Sprint 28.3 comprovou que o auth não fornecia escopo de unidade e manteve `/internal/pre-enrollments` desmontada.

## 3. Branch e HEAD

- Branch inicial: `sprint-23`.
- HEAD inicial: `03655df0a7cc95f1e482bda51f06856e3afb0d64`.
- Commit da Sprint 28.3: `03655df docs(auth): registra bloqueio seguro do contexto de unidade`.

## 4. Worktree inicial

O worktree começou limpo, sem arquivos staged ou alterações não rastreadas. O script temporário de auditoria read-only foi criado apenas depois dessa confirmação e removido antes da entrega.

## 5. Auditoria do repositório

- A rota principal `/unidades` é montada por `backend/src/server.js` e usa `backend/src/routes/unidades.routes.js`.
- Rotas principais, catálogo público, Pessoas, Turmas, BI e Financeiro consultam `j12_unidades`.
- O frontend usa `/unidades` por `src/lib/unidades-store.ts` e `src/stores/system-store.ts`.
- Nenhuma consulta de runtime encontrada usa `unidades` como catálogo operacional.
- `backend/auth.js` autentica diretamente por `j12_usuarios` e por `users`.
- `sanitizeUser` preserva a origem em `source`; IDs de namespaces diferentes são expostos no mesmo campo `id`.
- `createSession` grava `sub`, `source` e papel no JWT; `getUserBySessionToken` relê a origem indicada.
- `requireAuth` anexa o usuário sanitizado a `req.user` e `req.auth`.
- `requireRole` e `canManageSystem` autorizam somente por papel global; não há policy contextual por unidade.
- A pré-matrícula interna continua composta em módulo isolado, mas não é importada nem montada no servidor principal.
- Não foi encontrado sistema oficial de feature flags apropriado para ativar a rota após migration.

## 6. Auditoria do banco

Consultas executadas em transação `READ ONLY`, sem DDL/DML e sem migration `up`:

- servidor: Percona Server `5.7.44-48`;
- `j12_unidades`: 3 registros, IDs 3, 4 e 5;
- `unidades`: 0 registros;
- nenhuma FK física referencia `j12_unidades` ou `unidades`;
- existem referências lógicas a unidade em Alunos, Turmas, Presenças, Financeiro, Planos, Professores, Quadras e pré-matrículas legadas;
- `users`: 201 registros, 103 ativos;
- `j12_usuarios`: 97 registros, 97 ativos;
- correspondência por e-mail: 94; somente em `users`: 107; somente em `j12_usuarios`: 3;
- IDs espelho determinísticos entre os 94 pares: 0;
- há pares correspondentes com status divergente;
- `user_sessions`: 0 registros no momento da auditoria;
- nenhuma FK física referencia `users` ou `j12_usuarios`;
- `user_unit_memberships`: ausente;
- `j12_schema_migrations`: ausente.

Nomes de unidades e e-mails não foram emitidos. A comparação de nomes foi feita por hash normalizado e a comparação de usuários foi reportada apenas por contagens.

## 7. Comparação entre `j12_unidades` e `unidades`

| Critério                    | `j12_unidades`                            | `unidades`                      |
| --------------------------- | ----------------------------------------- | ------------------------------- |
| Uso no runtime moderno      | Amplo e direto                            | Nenhuma consulta encontrada     |
| Uso no frontend             | Indireto pela rota oficial `/unidades`    | Nenhum                          |
| Registros no banco auditado | 3                                         | 0                               |
| Status real                 | `ENUM('ativa','inativa')`, nullable       | `TINYINT(1) ativo`              |
| FKs recebidas               | 0                                         | 0                               |
| Cobertura funcional         | Catálogo, Turmas, BI, Financeiro, Pessoas | Legado sem cobertura comprovada |
| Decisão                     | Canônica operacional                      | Legada, sem fallback            |

Há drift crítico: as rotas e o DDL de runtime tratam `ativo`/`inativo`, enquanto a tabela real aceita `ativa`/`inativa`; os três registros apresentam status vazio. A Sprint não converterá esses dados automaticamente.

## 8. Decisão da unidade canônica

Foi comprovado o cenário A: `j12_unidades` é a entidade canônica de unidade operacional. `unidades` permanece intocada e não poderá sustentar fallback de autorização.

## 9. ADR/DEC criada

`docs/ADR/ADR-0006-UNIDADE-CANONICA-E-BLOQUEIO-DE-MEMBERSHIP.md` registra alternativas, evidências, decisão, consequências, compatibilidade, riscos e estratégia futura.

## 10. Tabela de usuário canônica

Não foi possível comprovar uma tabela única. `users` e `j12_usuarios` são origens autenticáveis reais, com namespaces de ID distintos e cobertura parcialmente sobreposta. O espelhamento por e-mail não produz uma chave física estável e o código tolera falha de espelhamento. Escolher uma das tabelas excluiria identidades válidas; usar e-mail ou FK polimórfica violaria integridade e segurança.

Esse é um critério formal de bloqueio da Sprint.

## 11. Regras do membership

Regras aprovadas para implementação futura, ainda sem persistência: vínculo entre identidade autenticável canônica e `j12_unidades`; um registro estrutural por usuário/unidade; status ativo/inativo; papel contextual alterável; sem bypass por papel global; sem seed automático.

## 12. Cardinalidade

O modelo futuro deverá ser N:N: um usuário pode atuar em uma ou várias unidades e uma unidade pode possuir vários usuários.

## 13. Status

Membership inativo nunca autoriza. Unidade inativa nunca autoriza. O vocabulário canônico do status de unidade precisa ser reconciliado antes da migration.

## 14. Papéis e permissões contextuais

Os papéis globais atuais não são suficientes. A capacidade futura `PRE_ENROLLMENT_INTERNAL_CREATE` deverá depender de membership ativo, unidade ativa e papel contextual comprovado. Admin global sem membership não terá bypass.

## 15. Identidade estrutural

A chave futura deverá garantir unicidade por usuário canônico e unidade canônica; papel não fará parte da identidade. A definição física foi adiada porque o tipo e a FK do usuário ainda não são comprováveis.

## 16. Schema e migration

Nenhuma migration de membership foi criada. Criá-la agora exigiria uma FK arbitrária e incompatível com parte dos usuários autenticáveis. Também falta formalizar `j12_unidades` no catálogo de migrations e reconciliar seu schema real.

## 17. Repository

Não criado. Sem tabela e identidade canônica, qualquer SQL de repository codificaria uma decisão insegura.

## 18. Application Service

Não criado. Não existe persistência segura sobre a qual validar usuário, unidade, status e concorrência.

## 19. Resolvedor

Não criado. Um resolvedor sem membership persistido só poderia confiar no cliente ou em fallback, ambos proibidos.

## 20. Middleware

Não criado. O middleware não pode fabricar autorização contextual quando o resolvedor persistido está bloqueado.

## 21. Estratégia para múltiplas unidades

Quando houver exatamente um membership ativo, a resolução automática ainda dependerá de decisão explícita futura. Com múltiplos memberships ativos, a seleção será obrigatória e nunca escolherá o primeiro registro. Body, query e header arbitrário não serão fontes de autorização.

## 22. Composição da pré-matrícula

A composição isolada existente foi auditada. Nenhuma integração adicional será feita enquanto a cadeia de membership estiver bloqueada.

## 23. Rota montada ou adiada

Adiada. `/internal/pre-enrollments` permanece desmontada, pois a tabela não existe, não há feature flag oficial, a identidade de usuário é ambígua e o status da unidade está em drift.

## 24. Segurança

O resultado é fail-closed: sem fallback para `unidades`, sem `unitId` de body/query/header como autorização, sem admin global como bypass, sem associação automática e sem alteração de JWT/sessão.

## 25. Observabilidade

Nenhum evento de membership é emitido porque o fluxo não existe. A futura implementação deverá reutilizar o logger estruturado e limitar campos a IDs, ação, resultado, código, duração, timestamp e correlation/request ID, sem PII ou tokens.

## 26. Arquivos criados

- `docs/ADR/ADR-0006-UNIDADE-CANONICA-E-BLOQUEIO-DE-MEMBERSHIP.md`;
- `docs/BACKEND/SPRINT_28_4.md`;
- `backend/src/domains/pessoas/presentation/tests/unit-membership-architecture-readiness.test.js`.

## 27. Arquivos alterados

Nenhum arquivo preexistente foi alterado. Não houve mudança de runtime, contrato, migration, schema, rota ou dado.

## 28. Testes

Foi criada uma suíte com três casos:

1. `j12_unidades` é a única entidade usada pelo catálogo de unidade montado;
2. o auth ainda expõe dois namespaces persistentes independentes;
3. membership e rota interna não são fabricados enquanto a identidade canônica está bloqueada.

Resultados:

- readiness das Sprints 28.3 e 28.4: 10/10;
- regressão dirigida das Sprints 28.1–28.4: 67/67;
- suíte backend completa: 1.046/1.046.

A suíte completa inclui Pessoas, Enrollment, CRM, autenticação, autorização, segurança, HTTP, observabilidade, migrations e migration runner.

## 29. Resultados

- testes específicos e regressão: aprovados;
- ESLint no arquivo JavaScript criado: aprovado, zero erros;
- ESLint amplo em `backend/src/domains/pessoas`: encontrou 61 violações preexistentes de formatação em arquivos fora do diff; nenhuma pertence ao arquivo da Sprint e nenhum arquivo alheio foi reformatado;
- Prettier/check nos três arquivos criados: aprovado;
- `npm run typecheck`: aprovado;
- `npm run build`: aprovado;
- `npm run ci:secrets`: 2.314 arquivos, zero achados;
- `git diff --check`, incluindo os arquivos não rastreados por comparação com `NUL`: aprovado; apenas avisos informativos de normalização LF/CRLF.

## 30. Migrations

O catálogo possui 23 migrations. `plan`, `up --dry-run` e `status` read-only passaram; o status mostrou todas as 23 como `PENDING` porque o banco não possui ledger adotado. Nenhum `up` foi executado. Antes de qualquer rollout, é necessário baseline/adoption formal do schema já existente.

## 31. Bloqueios

1. Não há identidade de usuário canônica nem mapeamento físico estável entre as duas origens autenticáveis.
2. `j12_unidades.status` diverge entre runtime e banco, com dados em estado vazio.
3. `j12_unidades` não possui migration fundacional no catálogo canônico.
4. O banco atual não adotou o ledger do migration runner.
5. Não existe feature flag oficial para montagem segura antes do rollout.

## 32. Riscos residuais

Autorização por papel global continua existindo nas rotas legadas, mas não será estendida à pré-matrícula. A dualidade de identidades e o drift de unidade precisam de remediação separada e auditável.

## 33. Rollback

As mudanças desta Sprint são documentação e testes estáticos/readiness; rollback consiste em revertê-los. Não há DDL, dado, contrato ou runtime para desfazer.

## 34. Plano de rollout

1. Aprovar identidade autenticável canônica e tabela de mapeamento físico, se necessária.
2. Reconciliar o status de `j12_unidades` com preflight e plano de dados explícito.
3. Adotar/baselinar o migration runner no ambiente alvo.
4. Criar e testar migration de membership sem aplicá-la automaticamente.
5. Aplicar em homologação com backup e validações.
6. Implementar repository, serviço, resolver e middleware.
7. Validar isolamento real e só então montar a rota em rollout controlado.

## 35. Recomendação para Sprint 28.5

Priorizar uma ADR e migration de identidade autenticável canônica, incluindo mapeamento durável entre `users` e `j12_usuarios`, política de sessões/JWT e reconciliação de status. Em paralelo, formalizar o schema de `j12_unidades` e o baseline do runner. O membership deve vir somente depois dessas fundações.
