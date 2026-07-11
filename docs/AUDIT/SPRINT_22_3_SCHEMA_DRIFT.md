# Sprint 22.3 - Schema drift

## Resultado

O schema fisico real nao foi acessado. Portanto, os itens abaixo sao drift entre fontes versionadas ou risco a confirmar, nunca afirmacao sobre HML/producao.

| Pri. | Divergencia                                                              | Evidencia                                                                                                           | Tratamento                                                                                                      |
| ---- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| P0   | Nao existe ledger/runner que prove quais migrations foram aplicadas.     | README declara execucao manual; nenhum Prisma/schema.prisma.                                                        | bloquear producao ate obter inventario de `information_schema` e ledger aprovado.                               |
| P0   | Schema nasce em startup/repository/service, fora de migrations.          | `config/db.js`, pessoas, pagamentos, automacoes, campeonatos e quadras contem DDL.                                  | nao remover por compatibilidade; migrar gradualmente para artefatos formais.                                    |
| P1   | Duas migrations criam `enrollment_class_links` com contratos diferentes. | timestamps 10:30 e 12:00; a primeira inclui `origin` e `metadata_json`, a segunda nao.                              | manter ambas ate conhecer HML; 10:30 e a referencia funcional; down 12:00 protegido nesta Sprint.               |
| P1   | `backend/sql/schema.sql` representa apenas uma fracao do bootstrap.      | somente `alunos` e `financeiro`.                                                                                    | nao usar como dump canonico.                                                                                    |
| P1   | Tipos de identificador variam (`INT`, `VARCHAR(64/191)` e casts).        | turma e quadra legadas usam inteiros; dominios modernos usam strings.                                               | validar tipo/collation antes de qualquer FK; nao adicionar FKs indiscriminadamente.                             |
| P1   | Financeiro possui tabelas paralelas.                                     | `financeiro`, `j12_financeiro_cobrancas`, `j12_mensalidades`, `j12_pagamentos`, `financial_payments` e obligations. | definir fonte canonica por fluxo antes de conciliacao real.                                                     |
| P2   | JSON e armazenado majoritariamente em LONGTEXT.                          | payloads, metadata e snapshots.                                                                                     | manter compatibilidade; validar JSON na aplicacao e avaliar CHECK/JSON somente apos versao MySQL e dados reais. |
| P2   | Status sao VARCHAR e normalizados em codigo/SQL com caixa e sinonimos.   | `LOWER/UPPER`, enums de entidades.                                                                                  | inventariar valores reais antes de enum/check.                                                                  |
| P2   | Timestamps misturam DATE/DATETIME e timezone de BI.                      | migrations e queries usam datas locais; BI usa America/Sao_Paulo.                                                   | documentar timezone do servidor e testar limites de dia/DST em HML.                                             |
| P2   | BI usa `CAST(id AS CHAR)` e comparacoes por nome/unidade.                | repositories BI.                                                                                                    | pode impedir indices; medir EXPLAIN com dados HML antes de indexar.                                             |
| P3   | Soft delete nao e transversal.                                           | `enrollments` e campeonatos usam `deleted_at`; legado usa `ativo`.                                                  | preservar semantica por dominio e documentar filtros obrigatorios.                                              |

## Relacionamentos

`people -> person_profiles -> enrollments -> enrollment_class_links -> j12_turmas` e `enrollments -> enrollment_financial_obligations` possuem FKs formais nas migrations. Responsaveis, professores, alunos e turmas legados misturam tabelas associativas e JSON. Agenda/notificacoes possuem FKs internas. Campeonatos, quadras e reservas criam relacionamentos no proprio dominio, sem migration formal global. BI apenas le essas fontes. A compatibilidade de engine, tipo, collation e dados orfaos deve ser comprovada antes de novas constraints.

## Performance

Relatorios financeiros paginam detalhes com `LIMIT/OFFSET`, mas agregacoes e `COUNT` continuam proporcionais ao periodo. BI faz agregacoes, unions e casts; historico de automacao possui indices simples em execucao, automacao, workflow, status, correlacao e inicio. Nao foi criado indice novo: sem cardinalidade e `EXPLAIN ANALYZE`, isso seria especulativo. Recomendacao de HML: slow-query log controlado, EXPLAIN dos filtros por periodo/status/unidade e teste de paginas profundas.
