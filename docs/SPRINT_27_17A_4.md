# Sprint 27.17A.4 — Colunas Normalizadas e Garantias Físicas Seguras

## Objetivo e estado anterior

Esta sprint adiciona armazenamento físico normalizado, backfill controlado e sincronização das gravações modernas de `people`. Antes dela, apenas `id` era único; CPF, e-mail e telefones eram nullable, brutos e sujeitos ao mapper legado. Nenhuma resolução, merge ou deduplicação foi adicionada.

## Arquitetura e schema auditados

Foram auditados a migration `20260712183000_create_people_domain_tables.sql`, `people.sql`, repository, mapper, validator, normalizador e diagnóstico das Sprints A.2/A.3, migrations JavaScript recentes, catálogo canônico e escritores encontrados por busca global.

O schema declarado é MySQL/InnoDB, `utf8mb4_unicode_ci`, com `id VARCHAR(64)`. `people` não possui tenant/unidade, tipo de pessoa, CNPJ ou soft delete; `ativo` não equivale a exclusão. CPF vazio pode chegar ao mapper, que o converte para `NULL`; SQL direto ainda pode produzir drift. Pessoa jurídica não está modelada, mas sua ausência no schema não prova uma regra de negócio global de CPF.

Os escritores foram classificados assim:

- moderno e integrado: `PersonRepository.create/update`, agora persiste original e normalizado na mesma instrução;
- moderno não integrado: orquestradores que não gravam diretamente, mas delegam ao repository;
- legado diferente: cadastros `j12_alunos` e `j12_responsaveis`, fora de `people`;
- SQL direto: fixture E2E de Sprint 23.11, que continuará podendo deixar normalizados nulos;
- desconhecido: operações manuais externas ao repositório não podem ser descartadas.

## Decisão arquitetural

Foi escolhida a opção A, colunas em `people`. Uma tabela `person_identifiers` aumentaria o impacto sem consumidores ou política de escopo prontos. Como existem dois telefones originais independentes, uma única `phone_normalized` perderia proveniência; foram criadas quatro colunas:

| Coluna                | Tipo           | Nulabilidade | Fonte      |
| --------------------- | -------------- | ------------ | ---------- |
| `cpf_normalized`      | `VARCHAR(11)`  | `NULL`       | `cpf`      |
| `email_normalized`    | `VARCHAR(191)` | `NULL`       | `email`    |
| `telefone_normalized` | `VARCHAR(50)`  | `NULL`       | `telefone` |
| `celular_normalized`  | `VARCHAR(50)`  | `NULL`       | `celular`  |

As colunas originais são preservadas. Não há generated column nem trigger porque SQL não reproduz comprovadamente todo o contrato JavaScript.

## Migration e backfill

A migration `20260717220000_add_people_normalized_identity_columns.js` depende explicitamente da foundation de Pessoas e possui `up`, `status` e `down`, além de factory com query runner injetável para testes.

O `up`:

1. falha se `people` não existir;
2. introspecta e adiciona apenas colunas ausentes;
3. recusa coluna existente com tipo, tamanho ou nulabilidade incompatível;
4. executa backfill JavaScript;
5. conta conflitos de CPF sem retornar valores;
6. cria apenas índices comuns ausentes e valida ordem/unicidade;
7. declara explicitamente que nenhuma constraint única foi criada.

O backfill reutiliza exclusivamente o normalizador A.2. Usa lotes padrão de 500, máximo de 2.000, e cursor `WHERE id > ? ORDER BY id ASC LIMIT ?`. Não usa `OFFSET` nem carrega a tabela inteira. Cada `UPDATE ... WHERE id = ?` é atômico por registro; não existe atomicidade global ou por lote. Uma falha preserva o progresso já gravado e a reexecução retoma com segurança, pois valores iguais são ignorados.

Valores inválidos ou ausentes não são inventados nem truncados e permanecem `NULL` quando a coluna ainda está vazia. Um valor normalizado preexistente não é apagado automaticamente quando a origem é inválida/ausente; esse drift requer revisão. Logs incluem somente contagens agregadas.

## Índices e conflitos

São criados índices não únicos:

- `idx_people_cpf_normalized`;
- `idx_people_email_normalized`;
- `idx_people_telefone_normalized`;
- `idx_people_celular_normalized`.

Os três índices de contato apoiam futuras buscas de candidatos e têm custo adicional de armazenamento e escrita. E-mail e telefones permanecem compartilháveis.

Não foi criada unicidade de CPF. O schema sugere Pessoa global, mas não comprova aprovação da regra global, ausência operacional de PJ ou inexistência de duplicados no banco vivo. A migration contabiliza grupos duplicados e nunca escolhe vencedor. A ativação futura deve ocorrer em migration separada somente após diagnóstico autorizado, saneamento e aprovação de escopo. Múltiplos `NULL` continuam permitidos pelos índices comuns.

## Sincronização e compatibilidade

`PersonRepository.create/update` deriva os quatro valores com o normalizador canônico e os grava na mesma instrução das origens. Para preservar compatibilidade, um valor anteriormente aceito pelo mapper mas rejeitado pelo contrato continua na coluna original e recebe normalizado `NULL`; a resolução futura deve tratá-lo como dado insuficiente/inválido.

O runtime DDL e `people.sql` foram alinhados para instalações novas. A migration histórica de foundation não foi alterada, preservando seu checksum. Versões antigas do backend ignoram as colunas nullable e continuam funcionando durante rolling deploy. Escritores SQL diretos podem gerar drift, mitigado por reexecução controlada do backfill e diagnóstico.

`findByCpf()` não foi alterado: ele ainda consulta CPF bruto e pode selecionar o registro mais recente. Não há serviço público, lookup normalizado, CRM, controller, frontend ou deduplicação nesta sprint.

## Status, rollback e erros

`status` informa, sem PII: existência da tabela, presença das colunas e índices, quantidade pendente ou inválida, grupos duplicados e ausência de unique. A contagem “pendente ou inválida” é conservadora porque SQL não tenta reproduzir a validação JavaScript.

`down` conta registros com qualquer normalizado. Se houver dados, falha com `PEOPLE_IDENTITY_DOWN_BLOCKED` e preserva tudo. Somente com todas as colunas vazias remove os quatro índices e depois as colunas. Não existe `DROP COLUMN` cego.

Erros determinísticos usados: `PEOPLE_IDENTITY_SCHEMA_UNSAFE`, `PEOPLE_IDENTITY_BACKFILL_INCOMPLETE` e `PEOPLE_IDENTITY_DOWN_BLOCKED`. Mensagens e detalhes não carregam CPF, e-mail, telefone ou nome.

## Catálogo de migrations

O catálogo é descoberto dinamicamente, mas o teste mantinha uma expectativa histórica fixa de 17 enquanto já existiam 19 migrations. Com esta migration, o total real é 20. A expectativa e o último item foram atualizados legitimamente; não houve alteração arbitrária no runner. A dependência explícita da foundation foi registrada.

## Rollout recomendado

1. confirmar o alvo e executar `status` em homologação controlada;
2. aplicar a migration estrutural/backfill com o runner canônico e lock de migration;
3. verificar métricas, colunas e índices;
4. publicar o código do repository compatível;
5. executar diagnóstico de drift e conflitos;
6. sanear conflitos com aprovação humana;
7. avaliar unique de CPF em migration futura;
8. somente então iniciar o resolvedor da A.5.

O `ALTER TABLE` e a criação de quatro índices podem bloquear ou consumir I/O em tabelas grandes. Homologação deve medir volume, duração e estratégia online suportada pela versão real do MySQL. Esta implementação não foi executada em banco vivo.

## Testes e garantias reais

Os testes com query runner fake validam SQL gerado e sequência de chamadas, não uma garantia física real do MySQL. Cobrem tabela/colunas/índices ausentes ou existentes, reexecução, status, rollback protegido, normalização, inválidos, múltiplos lotes, cursor, retomada, conflitos, PII e integração do repository. A validação física de DDL, índices, múltiplos `NULL`, tempo de lock e reexecução ainda deve ocorrer em MySQL local/homologação controlada.

## Limitações, riscos residuais e gate da A.5

- unique de CPF bloqueado por regra de negócio e dados vivos não confirmados;
- SQL direto/versão antiga pode deixar colunas nulas;
- backfill não é transação global;
- quatro índices aumentam custo de escrita;
- CPF não possui validação de dígito verificador por decisão do contrato A.2;
- `findByCpf()` bruto continua ambíguo;
- não há proteção concorrente de criação por CPF enquanto unique estiver bloqueado.

A Sprint A.5 só deve iniciar para leitura/diagnóstico se aceitar esses limites. Criação idempotente concorrente por CPF exige antes: zero conflitos impeditivos, escopo global formalmente aprovado, validação física em MySQL e uma migration separada ativando unique em `cpf_normalized`. Sem isso, o resolvedor não pode prometer `CREATED` idempotente sob múltiplos processos.
