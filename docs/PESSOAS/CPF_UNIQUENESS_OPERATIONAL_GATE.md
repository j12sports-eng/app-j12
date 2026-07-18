# Gate Operacional de Unicidade de CPF

## Estado atual

- estado da execução MySQL: `NOT_EXECUTED`;
- decisão sobre unique: `BLOCKED`;
- ambiente local seguro: indisponível;
- ambiente remoto conhecido: não autorizado e não acessado;
- PII real: desconhecida no alvo remoto, portanto proibido;
- unique de `cpf_normalized`: não criar.

A Sprint 27.17A.4.1C repetiu o gate zero em 18/07/2026 e classificou a capacidade como `UNAVAILABLE`. Foi preparado um ambiente Docker opcional e fail-closed para execução futura, mas Docker/MySQL continuam ausentes neste host. Nenhuma evidência física foi promovida e o gate permanece `NOT_EXECUTED/BLOCKED`.

## Gate zero

Em 17/07/2026 foram verificadas somente capacidades locais:

- Docker: indisponível;
- CLI MySQL: indisponível;
- serviço MySQL/MariaDB local: não encontrado;
- listener local TCP 3306: não encontrado.

O projeto possui configuração capaz de apontar para host remoto. Ela não comprova ambiente de homologação, descarte, ausência de PII ou autorização. Nenhum teste de conexão foi realizado.

## Evidências obrigatórias

O avaliador `evaluateCpfUniquenessGate()` só aprova quando todas as evidências são booleanas e positivas, `duplicateGroups` é zero e há confirmação operacional sobre:

1. ambiente MySQL real de teste;
2. migration aplicada;
3. reexecução idempotente;
4. status sem PII;
5. rollback;
6. múltiplos `NULL`;
7. backfill concluído;
8. dados operacionais autorizados disponíveis;
9. zero duplicidades;
10. Pessoa global;
11. tabela restrita a Pessoa Física;
12. ausência de uso legítimo repetido de CPF;
13. todos os writers sincronizados;
14. impossibilidade de CPF original com normalizado nulo;
15. schema compatível;
16. rollout do unique definido;
17. impacto operacional aceito.

O avaliador não consulta banco e não cria índice. `state=NOT_EXECUTED` representa ausência de execução física; `decision=BLOCKED` impede a Sprint A.4.2.

## Evidência de negócio no repositório

| Pergunta                                               | Classificação                    | Evidência                                                                     |
| ------------------------------------------------------ | -------------------------------- | ----------------------------------------------------------------------------- |
| Pessoa é global no schema moderno?                     | `CONFIRMED` tecnicamente         | `people` não possui unidade/tenant.                                           |
| A mesma Pessoa pode existir por unidade?               | `NOT_CONFIRMED`                  | O ERP possui unidades, mas a política civil não está formalizada.             |
| `people` contém apenas Pessoa Física?                  | `NOT_CONFIRMED`                  | Não há `person_type`/CNPJ, mas ausência de coluna não é proibição de negócio. |
| Há ou haverá PJ na tabela?                             | `NOT_CONFIRMED`                  | Documentos arquiteturais mencionam CPF/CNPJ genericamente.                    |
| CPF pode faltar?                                       | `CONFIRMED`                      | `cpf VARCHAR(20) NULL` e serviços não o exigem.                               |
| Estrangeiro sem CPF é permitido?                       | `NOT_CONFIRMED`                  | Não existe política encontrada.                                               |
| Cadastro provisório sem CPF é permitido?               | `CONFIRMED` tecnicamente         | Schema e repository aceitam `NULL`.                                           |
| CPF pode aparecer legitimamente em mais de uma Pessoa? | `NOT_CONFIRMED`                  | Documento alvo sugere um CPF por Pessoa ativa, sem decisão para inativos/PJ.  |
| Inativos permanecem na tabela?                         | `CONFIRMED`                      | Campo `ativo`; repository não remove automaticamente.                         |
| Existe soft delete em `people`?                        | `NOT_APPLICABLE` no schema atual | Não há `deleted_at`; existe delete físico no repository.                      |
| CPF pode ser alterado?                                 | `CONFIRMED` tecnicamente         | `PersonRepository.update()` permite atualização.                              |
| Existe histórico de documento?                         | `NOT_CONFIRMED`                  | Nenhuma tabela de histórico foi encontrada.                                   |
| Há writers fora do repository moderno?                 | `CONFIRMED`                      | Fixture E2E faz SQL direto; sistemas externos permanecem desconhecidos.       |

## Writers e drift

- `PersonRepository.create/update`: sincronizado atomicamente para valores aceitos pelo normalizador;
- `PersonApplicationService` e fluxos modernos: delegam ao repository;
- fixture `scripts/e2e/sprint-23-11-fixtures.cjs`: SQL direto sintético agora sincronizado com o normalizador canônico;
- cadastros legados `j12_alunos`/`j12_responsaveis`: não escrevem `people`, mas mantêm identidade paralela;
- importadores e SQL externos: desconhecidos.

O inventário A.4.1B encontrou todos os writers controlados conhecidos sincronizados e adicionou proteção contra novo SQL literal não auditado. O blocker `LEGACY_WRITERS_UNSYNCHRONIZED` passou a `PARTIALLY_RESOLVED`: as colunas ainda são nullable e writers manuais/externos não podem ser excluídos. Antes da A.4.2 é necessário bloquear esses caminhos ou especificar outra garantia física capaz de reproduzir exatamente o contrato. Trigger/generated column não fazem parte desta sprint.

## Roteiro para execução futura

Pré-condições:

- MySQL local/container ou homologação explicitamente autorizada;
- schema descartável e exclusivo;
- `isProduction=false` confirmado;
- `containsRealPII=false` confirmado;
- versão, categoria do host e categoria do schema registradas sem credenciais;
- backup não é necessário para schema descartável, mas o alvo deve ser conferido duas vezes.

Ordem:

1. criar schema isolado segundo a convenção do ambiente;
2. apontar o migration runner com confirmação explícita do nome;
3. aplicar somente a foundation de Pessoas e dependências canônicas;
4. inserir fixtures inteiramente sintéticas;
5. medir estado inicial sem imprimir valores;
6. aplicar a migration A.4 e registrar duração/avisos;
7. executar novamente o `up` e o `status`;
8. executar `PESSOAS_IDENTITY_UNIQUENESS_GATE.sql`;
9. validar backfill, originais preservados, múltiplos `NULL` e duplicidade sintética;
10. testar `down` bloqueado com dados;
11. em outro schema vazio, testar `down` seguro e estado parcial;
12. destruir o schema descartável conforme processo aprovado.

Não são fornecidos comandos com host, usuário, senha ou connection string. O operador deve usar o runner canônico e a política de secrets do ambiente.

## Blockers atuais

- `MYSQL_ENVIRONMENT_UNAVAILABLE`;
- `MYSQL_VALIDATION_FAILED` — significa “não validado”, não falha observada no MySQL;
- `OPERATIONAL_DATA_UNAVAILABLE`;
- `IDENTITY_SCOPE_NOT_CONFIRMED`;
- `LEGAL_ENTITY_MODEL_NOT_CONFIRMED`;
- `LEGITIMATE_DUPLICATE_USE_NOT_EXCLUDED`;
- `LEGACY_WRITERS_UNSYNCHRONIZED`;
- `MIGRATION_NOT_APPLIED` no MySQL real de teste;
- `MIGRATION_NOT_IDEMPOTENT` no MySQL real de teste;
- `MULTIPLE_NULLS_NOT_VALIDATED` fisicamente;
- `ROLLBACK_NOT_VALIDATED` fisicamente;
- `STATUS_NOT_VALIDATED` fisicamente;
- `SCHEMA_MISMATCH` permanece não descartado;
- `UNIQUE_ROLLOUT_NOT_DEFINED`;
- `OPERATIONAL_IMPACT_NOT_ACCEPTED`.

## Critério de desbloqueio

Todos os blockers devem ser eliminados simultaneamente. Testes fake ou dados sintéticos isoladamente não aprovam qualidade operacional. A A.4.2 não deve começar enquanto `decision` não for `APPROVED`; a A.5 também permanece bloqueada para criação concorrente idempotente.
