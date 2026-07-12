# Sprint 23.2 — Ponte financeira canônica

Data: 2026-07-12.

## Decisão executiva

**BLOQUEADA PARA IMPLEMENTAÇÃO SEGURA COM O SCHEMA VERSIONADO ATUAL.**

A lacuna `enrollment_financial_obligations → j12_mensalidades → j12_financeiro_cobrancas` foi novamente comprovada, mas não pode ser fechada sem inventar identidade ou constraint. Esta Sprint não criou migration, não executou migration e não alterou código de produção.

Três requisitos estruturais faltam ao mesmo tempo:

1. `enrollments` identifica o aluno por `student_person_id` e `student_profile_id`, enquanto cobranças exigem `j12_alunos.id`; não há vínculo canônico versionado entre essas identidades.
2. `enrollment_financial_obligations` não possui `charge_id`/`installment_id`, e `j12_financeiro_cobrancas` não possui `obligation_id`/`enrollment_id` com unicidade.
3. A cobrança não possui unique key que represente a idempotência da obrigação. A checagem legado por aluno, competência e plano ocorre antes do `INSERT`, não fecha corrida e ainda ignora matrícula/obrigação.

Usar nome, CPF, número de matrícula, `j12_alunos.id`, metadata JSON ou convenção de ID seria inferência não garantida pelo schema. Usar somente `obligation.id` como `charge.id` não resolveria a identidade obrigatória do aluno nem impediria outro gerador de criar uma cobrança equivalente com ID diferente. Portanto, a implementação foi corretamente recusada.

## Base e auditoria inicial

- Branch: `sprint-23`.
- HEAD: `f79c4dbba7a80d675b6354b9b66648d7a5608645`.
- `git status --short`: limpo.
- `git diff --stat` e `git diff --name-status`: vazios.
- Untracked: nenhum.
- Nenhum banco, migration, Banco Inter, Pix, webhook, n8n, commit, push ou tag foi usado.

Foram lidos integralmente:

- Sprint 22.3: `SPRINT_22_3_SCHEMA_DRIFT.md`, `SPRINT_22_3_MIGRATION_INVENTORY.md` e `SPRINT_22_3_DATABASE_INTEGRITY.md`;
- Sprint 22.7: `SPRINT_22_7_FINANCIAL_E2E_HOMOLOGATION.md`;
- Sprint 22.10: `SPRINT_22_10_GLOBAL_E2E_REGRESSION.md`;
- Sprint 22.11: `SPRINT_22_11_FINAL_SYSTEM_HOMOLOGATION.md`;
- Sprint 22 final: `SPRINT_22_FINAL_REPORT.md`;
- Sprint 23.1: `docs/SECURITY/SPRINT_23_1_CREDENTIAL_REMEDIATION.md`.

## Matriz antes/depois

| Estágio              | Antes da Sprint 23.2                       | Depois da Sprint 23.2 | Fonte canônica comprovada                                       |
| -------------------- | ------------------------------------------ | --------------------- | --------------------------------------------------------------- |
| Matrícula            | Persistência própria, IDs Pessoa/Profile   | Preservado            | `enrollments`                                                   |
| Obrigação            | Criação/reuso por matrícula e tipo         | Preservado            | `enrollment_financial_obligations`                              |
| Ponte de identidade  | Ausente                                    | Bloqueio documentado  | Nenhuma                                                         |
| Mensalidade          | Espelho legado de cobrança                 | Preservado            | `j12_mensalidades`, somente como espelho                        |
| Cobrança             | Geração legada paralela                    | Preservado            | `j12_financeiro_cobrancas` como única fonte monetária/BI        |
| Pagamento local      | Liquidação espelhada                       | Preservado            | `j12_pagamentos`                                                |
| Integração Pix/Inter | Registro de integração                     | Preservado            | `financial_payments`                                            |
| Conciliação/baixa    | Atualiza pagamento, cobrança e mensalidade | Preservado            | cobrança determina o estado monetário; espelhos não são somados |
| BI                   | Lê somente cobranças                       | Preservado            | `j12_financeiro_cobrancas`                                      |

Não houve “depois” funcional artificial: o P0 continua aberto, agora com pré-condições explícitas e verificáveis.

## Mapeamento ponta a ponta

### Matrícula

O fluxo moderno cria Pessoa, Profile e relacionamento, prepara um `draftEnrollment`, persiste `enrollments` pelo `MySqlEnrollmentRepository` e confirma `DRAFT → ACTIVE`. A tabela contém `id`, `student_person_id`, `student_profile_id`, status, datas e metadados; não contém `j12_aluno_id`, unidade ou plano canônico. Cancelamento existe no agregado, mas o repository de status exposto está orientado à confirmação; reativação canônica e propagação financeira não estão implementadas.

### Obrigação financeira

`FinancialApplicationService` valida matrícula, identidade Pessoa/Profile, status `ACTIVE`, plano, valor, ciclo, moeda e vencimento. Quando o contrato está completo, `MySqlEnrollmentFinancialObligationRepository` cria ou reutiliza `INITIAL_ENROLLMENT_OBLIGATION`.

O schema usa `DECIMAL(12,2)` e unique `(enrollment_id, obligation_type)`. Estados: `PREPARED`, `PENDING`, `OVERDUE`, `PAID` e `CANCELLED`. Cancelamento guarda data, ator e auditoria em metadata. Não há FK ou coluna para mensalidade/cobrança.

### Mensalidade e cobrança legadas

`student-finance.js` gera primeiro uma cobrança e depois sincroniza `j12_mensalidades` por `cobranca_id`. A mensalidade possui unique em `cobranca_id`; assim, ela é espelho, não fonte monetária. A geração legado evita repetição consultando `aluno_id + competencia + plano_id + status != cancelado`, porém não há unique correspondente em `j12_financeiro_cobrancas` e a operação `SELECT → INSERT` pode competir.

`j12_financeiro_cobrancas` concentra valor original/final, descontos, bolsas, vencimento, status, plano, turma, unidade, responsável e dados de contato. O valor final legado é calculado com `Number` e arredondamento; a obrigação usa `DECIMAL`, mas também é normalizada para `Number` na aplicação. A precisão persistida é centesimal, porém uma ponte futura deve operar em centavos inteiros na aplicação para evitar diferenças binárias.

### Pagamento, conciliação, baixa e BI

`financial_payments` representa a integração Pix/Inter e `j12_pagamentos` registra liquidação. A baixa transacional existente atualiza cobrança e mensalidade e bloqueia pagamento parcial/divergente como quitação integral. Status cancelado, expirado ou devolvido não é pago. O BI declara e implementa `j12_financeiro_cobrancas` como única fonte monetária, evitando somar obrigação, mensalidade e pagamentos.

## Aspectos obrigatórios

| Aspecto          | Evidência                                                                  | Situação da ponte                                                       |
| ---------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Idempotência     | unique de obrigação; unique mensalidade por cobrança                       | insuficiente na cobrança e na ligação obrigação-cobrança                |
| Status           | enums de matrícula, obrigação e legado são diferentes                      | falta máquina de transição entre domínios                               |
| Vencimento       | obrigação `due_date`; cobrança `vencimento`; mensalidade `data_vencimento` | campos compatíveis, sem vínculo                                         |
| Valor            | obrigação `DECIMAL(12,2)`; legado `DECIMAL(10,2)`                          | faixa diferente; exige validação de overflow e centavos                 |
| Descontos/bolsas | existem na cobrança e no snapshot legado                                   | não existem como campos canônicos da obrigação; não se pode reconstruir |
| Dependentes      | Pessoa/Profile distingue identidade                                        | cobrança exige aluno legado; associação não existe                      |
| Unidade          | cobrança tem texto; matrícula não tem `unit_id`                            | não pode ser resolvida canonicamente                                    |
| Cancelamento     | matrícula/obrigação/cobrança têm semânticas próprias                       | propagação não definida; cobrança cancelada não pode ser baixada        |
| Reativação       | não há fluxo canônico ponta a ponta                                        | não implementar por inferência                                          |
| Duplicidade      | checks parciais em cada estágio                                            | falta constraint transversal                                            |
| Transações       | helpers existem e baixa usa transação                                      | não compensam identidade/constraint ausentes                            |
| Auditoria        | obrigação guarda ator/status em metadata; cobrança tem alteração/motivo    | não há audit trail da materialização                                    |
| BI               | cobrança é única fonte monetária                                           | decisão preservada                                                      |

## Invariantes aprovados para a implementação futura

1. Somente matrícula `ACTIVE`, não removida, pode originar obrigação/cobrança.
2. Obrigação `CANCELLED` nunca materializa nem baixa cobrança.
3. Uma obrigação materializa no máximo uma cobrança, e uma cobrança de mensalidade possui no máximo um espelho de mensalidade.
4. Retry e concorrência devem ser resolvidos por unique key no banco, não apenas por consulta prévia.
5. Obrigação, link, cobrança e mensalidade devem ser gravados em uma transação InnoDB quando criados juntos.
6. Valores devem ser comparados/calculados em centavos; pagamento parcial nunca equivale a quitação total.
7. Cobrança cancelada não pode ser conciliada como paga.
8. `j12_financeiro_cobrancas` continua sendo a única fonte monetária do BI.
9. Desconto, bolsa, unidade, dependente e responsável devem vir de fonte identificada e versionada, nunca de busca por nome/documento.
10. Cancelamento/reativação exigem política explícita e histórico, sem apagar registros financeiros.

## Schema mínimo necessário — não implementado

O próximo desenho deve ser aprovado com base em schema físico conhecido. No mínimo, precisa fornecer:

- vínculo canônico e único entre Pessoa/Profile moderno e `j12_alunos.id`, ou migrar cobranças para a identidade moderna;
- tabela/link versionado entre `obligation_id`, `charge_id` e `installment_id`, com FKs, uniques, timestamps e auditoria; alternativamente, colunas equivalentes com as mesmas garantias;
- unique key de negócio da cobrança que inclua a origem da obrigação;
- política de status, cancelamento, reativação, competência, desconto/bolsa e unidade;
- migration com preflight de duplicatas/orfandade, compatibilidade de tipos/collation e rollback não destrutivo.

Criar esse schema nesta Sprint sem `information_schema`, ledger e decisão de identidade violaria a proibição de inventar schema.

## Bugs e riscos encontrados

- **P0 mantido:** não existe ponte canônica obrigação→cobrança/mensalidade.
- **P0 de integridade potencial:** uma ponte por `studentPersonId` ou `studentProfileId` não cabe em `aluno_id` sem mapa explícito e pode cobrar o dependente errado.
- **P1 de concorrência:** a prevenção legado por `SELECT` não possui unique correspondente na cobrança.
- **P1 de contrato:** descontos e bolsas alteram `valor_final`, mas não fazem parte do registro canônico da obrigação.
- **P1 de lifecycle:** cancelamento/reativação de matrícula não propaga de forma canônica.
- **P2 de precisão/faixa:** `DECIMAL(12,2)` da obrigação precisa caber em `DECIMAL(10,2)` da cobrança; conversões atuais usam `Number`.
- **P2 de unidade:** matrícula moderna não oferece escopo de unidade confiável para materialização/BI.

Nenhum desses itens foi “corrigido” superficialmente, pois todos dependem da decisão/schema acima.

## Testes solicitados e evidência real

Como a pré-condição de schema falhou, não existe implementação da ponte sobre a qual executar happy path E2E sem mock ou schema inventado.

| Cenário solicitado               | Evidência disponível                                      | Resultado real                                   |
| -------------------------------- | --------------------------------------------------------- | ------------------------------------------------ |
| Happy path                       | obrigação isolada e geração legado isolada                | ponte não executável                             |
| Retry idempotente                | unique da obrigação e reuso testados                      | cobrança transversal não comprovada              |
| Obrigação já processada          | não há marcador/link de processamento                     | bloqueado por schema                             |
| Duplicidade                      | obrigação e mensalidade têm uniques parciais              | cobrança continua sem garantia transversal       |
| Falha intermediária/rollback     | testes de transaction runner e repository isolado         | transação da ponte inexiste                      |
| Valor em centavos                | persistência DECIMAL e proteção de divergência existentes | conversão da ponte inexiste                      |
| Matrícula cancelada              | contratos exigem `ACTIVE`                                 | criação da obrigação é bloqueada; ponte inexiste |
| Obrigação cancelada              | transição e auditoria testadas                            | propagação inexiste                              |
| Ausência de configuração         | billing contract retorna blockers                         | coberto no estágio de obrigação                  |
| Concorrência lógica              | duplicate de obrigação é tratado                          | cobrança não tem unique suficiente               |
| Integração com status financeiro | baixa/reconciliação isoladas                              | cadeia completa não comprovada                   |

Não foram adicionados mocks para declarar E2E. Os testes focados existentes serão executados como regressão dos invariantes já implementados; eles não serão promovidos a evidência da ponte.

## Limitações e percentual real

- Implementação da ponte: **0%**.
- Mapeamento/auditoria estática solicitada: **100%**.
- Testes da ponte: **0%**, pois não há schema/implementação segura.
- Sprint 23.2 total: **45%** (auditoria, decisão canônica, invariantes, matriz e gates locais; materialização, testes integrados e validação em banco permanecem bloqueados).
- E2E financeiro completo: **0% comprovado**.

O percentual não confunde quantidade de testes existentes com fechamento do P0.

## Arquivos alterados

- `docs/AUDIT/SPRINT_23_2_CANONICAL_FINANCIAL_BRIDGE.md`: auditoria, decisão de bloqueio, fontes canônicas, invariantes, matriz, testes e limitações.

Nenhum contrato, service, repository, route, frontend ou migration foi modificado. A Sprint 23.3 não foi iniciada.
