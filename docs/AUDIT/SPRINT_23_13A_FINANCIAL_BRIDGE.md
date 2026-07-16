# Sprint 23.13A - Bridge financeira canônica

Esta etapa cria somente a estrutura versionada e o repository transacional da
ligação bidirecional entre obrigação, cobrança e mensalidade. Não materializa
cobranças ou mensalidades e não altera pagamentos, Banco Inter, BI, Browser
E2E, CI, deploy ou infraestrutura.

## Estrutura

`enrollment_financial_bridges` contém `obligation_id`, `charge_id`,
`installment_id`, `legacy_student_id`, `enrollment_id`, `status`, `created_by`,
`created_at` e `updated_at`.

`obligation_id` é a chave primária. Cobrança e mensalidade possuem uniques
independentes. As cinco identidades possuem FKs com `ON DELETE RESTRICT`. A
migration valida tabelas, engine, tipos e collation antes de criar a estrutura;
o rollback recusa remover uma tabela populada.

## Repository

O `MySqlEnrollmentFinancialBridgeRepository` cria ou reutiliza a bridge e
consulta por obrigação, cobrança ou mensalidade. Todas as operações usam o
transaction runner. Concorrência e retry convergem pelas constraints do banco;
conflitos diferentes falham fechados.

## Validação

Os resultados de testes, arquivos e estado Git são registrados na entrega da
Sprint. Nenhum banco ou ambiente externo é necessário para os testes locais.
