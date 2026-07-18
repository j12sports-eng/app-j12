# Inventário Canônico de Writers de Pessoa

## Escopo e método

Inventário da Sprint 27.17A.4.1B para operações que criam, atualizam ou removem linhas de `people`. A auditoria pesquisou `INSERT`, `UPDATE`, `REPLACE`, `DELETE`, repositories, services, query runners, controllers, rotas, scripts, imports, seeds, fixtures, E2E, migrations, CRM, Alunos, Responsáveis, Matrículas, portais, jobs e integrações.

Leituras, FKs, DDL estrutural e SQL documental foram separados de writers de registros. Cadastros em tabelas paralelas legadas são registrados como risco arquitetural, mas não contados como writers de `people`.

## Lista fechada de classificações

- `MODERN_SYNCHRONIZED`
- `MODERN_UNSYNCHRONIZED`
- `LEGACY_CONTROLLED`
- `LEGACY_RISKY`
- `DIRECT_SQL`
- `TEST_FIXTURE`
- `MIGRATION_ONLY`
- `EXTERNAL_OR_UNKNOWN`

## Writers e ocorrências auditadas

| Identificador                              | Arquivo/camada                         | Operação e tipo                           | Sincronização                            | Normalizador/transação                        | Risco e decisão                                            |
| ------------------------------------------ | -------------------------------------- | ----------------------------------------- | ---------------------------------------- | --------------------------------------------- | ---------------------------------------------------------- |
| `PERSON_REPOSITORY_CREATE`                 | `person.repository.js`, infraestrutura | `INSERT`, `MODERN_SYNCHRONIZED`           | original + 4 normalizados                | normalizador A.2; uma instrução parametrizada | baixo; `ALREADY_SAFE`                                      |
| `PERSON_REPOSITORY_UPDATE`                 | `person.repository.js`, infraestrutura | `UPDATE`, `MODERN_SYNCHRONIZED`           | original + 4 normalizados                | normalizador A.2; uma instrução parametrizada | baixo; corrigido `null` explícito, `MIGRATE_NOW` concluído |
| `PERSON_REPOSITORY_DELETE`                 | `person.repository.js`, infraestrutura | `DELETE`, `MODERN_SYNCHRONIZED`           | não deixa linha sobrevivente             | uma instrução parametrizada                   | não produz drift; `ALREADY_SAFE`                           |
| `PERSON_IDENTITY_BACKFILL`                 | migration A.4                          | `UPDATE`, `MIGRATION_ONLY`                | preenche somente normalizados válidos    | normalizador A.2; atomicidade por registro    | não operacional; `ALREADY_SAFE`                            |
| `SPRINT_23_11_E2E_PERSON_FIXTURE`          | fixture E2E                            | `INSERT ... ON DUPLICATE`, `TEST_FIXTURE` | e-mail/telefone originais e normalizados | normalizador A.2; transação da jornada        | era o único SQL direto executável; migrado agora           |
| `PERSON_MIGRATION_FAKE_SQL_FIXTURE`        | teste da migration                     | strings `INSERT/UPDATE`, `TEST_FIXTURE`   | fake sem banco                           | não executa MySQL                             | allowlist para proteção de regressão                       |
| `PERSON_WRITER_CONSISTENCY_SQL_ASSERTIONS` | teste dos writers                      | strings `INSERT/UPDATE`, `TEST_FIXTURE`   | fake sem banco                           | não executa MySQL                             | allowlist para verificar atomicidade                       |
| `PERSON_DIAGNOSTIC_REJECTION_FIXTURE`      | teste do diagnóstico                   | strings `UPDATE/DELETE`, `TEST_FIXTURE`   | propositalmente rejeitadas               | guard read-only; não executa banco            | não é writer; allowlist explícita                          |

Total: 8 entradas auditadas — 3 `MODERN_SYNCHRONIZED`, 4 `TEST_FIXTURE` e 1 `MIGRATION_ONLY`. Não foram encontrados `MODERN_UNSYNCHRONIZED`, `LEGACY_CONTROLLED`, `LEGACY_RISKY` ou `DIRECT_SQL` operacionais restantes dentro do repositório.

## Fluxos que não escrevem `people`

- Alunos administrativos/completos escrevem `j12_alunos` e tabelas auxiliares.
- Responsáveis legados escrevem `j12_responsaveis` e vínculos.
- Pré-matrícula escreve `pre_matriculas`.
- CRM escreve `crm_leads`; conversão para Pessoa continua bloqueada.
- Enrollment/BI fazem leitura/join de `people` ou delegam criação ao `PersonApplicationService`.
- portais, financeiro e notificações usam identidades existentes.
- não foi encontrado importador CSV/XLSX ou job ativo gravando `people`.

Esses fluxos paralelos ainda podem representar a mesma pessoa civil fora do domínio moderno, mas não conseguem criar `cpf` com `cpf_normalized=NULL` em `people` pelo código auditado.

## Alterações desta sprint

### Update parcial

O mapper e o repository agora distinguem propriedade ausente de propriedade explicitamente `null`. O `PersonService` mantém os campos flat alinhados quando o patch usa `contact` ou documento CPF. Assim:

- campo ausente é preservado pelo merge do service;
- campo explicitamente nulo limpa original e normalizado;
- campo alterado recalcula o normalizado;
- original e normalizado seguem na mesma instrução SQL.

`PersonRepository.update()` continua sendo update completo; o contrato de patch parcial pertence ao `PersonService`, que lê e mescla a linha antes de delegar.

### Fixture E2E

A fixture sintética Sprint 23.11 importa `normalizeEmail`/`normalizePhone` e persiste `email_normalized`/`telefone_normalized` no mesmo upsert. Ela exige que a migration A.4 já tenha sido aplicada, coerente com a ordem oficial `migration → código/fixture`.

## Proteção contra regressão

`person-writers-inventory.test.js` varre somente `backend`, `scripts` e `src`, com extensões de código/SQL conhecidas. Qualquer novo SQL literal `INSERT/UPDATE/REPLACE/DELETE` em `people` falha se arquivo e operação não estiverem na allowlist exata. Não há glob amplo, dependências, builds ou documentação no scan.

`person-writers.allowlist.js` registra arquivo, operações, classificação, sincronização e motivo. Entradas do repository com tabela dinâmica também são inventariadas, embora a proteção literal mire bypasses diretos.

## Rolling deploy

O código moderno e a fixture exigem as colunas A.4. A ordem obrigatória permanece:

1. aplicar a migration A.4;
2. confirmar `status` e colunas;
3. publicar o código novo;
4. executar fixture apenas no E2E isolado.

Não foi criado fallback silencioso para schema antigo, pois ele perderia normalização. Se o código novo iniciar antes da migration, a gravação deve falhar e o deploy deve ser corrigido.

## Writers externos e risco residual

Nenhuma integração externa de escrita direta foi encontrada no repositório. Isso não prova inexistência de SQL/manual externo. Como as colunas normalizadas permanecem nullable, qualquer writer fora do código auditado ainda pode gravar CPF bruto sem normalizado e contornar um futuro unique.

Estado do blocker: `PARTIALLY_RESOLVED`.

- resolvido para writers controlados e executáveis conhecidos;
- pendente para writers externos/desconhecidos e garantia física contra bypass;
- cadastros civis paralelos de Alunos/Responsáveis continuam fora da consolidação de Pessoa.

Reavaliação exige inventário operacional do ambiente, política que proíba escrita direta, validação MySQL e mecanismo físico/aplicacional que torne impossível `cpf` presente com `cpf_normalized=NULL`.
