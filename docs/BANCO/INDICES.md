# Indices

Indices identificados e recomendacoes para performance.

## Indice

- [Resumo](#resumo)
- [Indices Existentes](#indices-existentes)
- [Consultas Criticas](#consultas-criticas)
- [Recomendacoes](#recomendacoes)
- [Cuidados](#cuidados)
- [Links Relacionados](#links-relacionados)

## Resumo

Indices sao criados principalmente por `ensureIndex` em `backend/src/config/db.js`. Alguns indices unicos existem para usuarios, matriculas e pagamentos.

## Indices Existentes

Exemplos observados:

- `users.email`, `users.login`.
- `users.role`.
- `j12_alunos.status`, `j12_alunos.nome_completo`, `j12_alunos.numero_matricula`.
- `j12_turmas.nome`, `j12_turmas.status`, `j12_turmas.modalidade`.
- `j12_financeiro_cobrancas.aluno_id`, `status`, `competencia`, `vencimento`.
- `j12_mensalidades.cobranca_id`, `aluno_id`, `referencia`, `status`.
- `financial_payments.txid`, `status`, `student_id`.
- `inter_webhook_events.event_hash`, `txid`, `e2eid`.

## Consultas Criticas

- Login por email/login.
- Listagem de alunos.
- Financeiro por aluno/status/competencia.
- Dashboard financeiro.
- Portal responsavel por alunos vinculados.
- Webhook Pix por `txid`.

## Recomendacoes

- Confirmar indices reais no banco de homologacao/producao.
- Criar indice composto apenas com base em queries medidas.
- Avaliar indice para aniversarios se consulta for feita no banco por `MONTH(data_nascimento)` e `DAY(data_nascimento)`.
- Evitar indices redundantes.

## Cuidados

- Indices em colunas calculadas por funcao podem nao ser usados.
- JSONs nao sao bons para filtros frequentes.
- Criacao automatica no boot deve ser substituida por migrations.

## Links Relacionados

- [Tabelas](./TABELAS.md)
- [Dashboard](../ARQUITETURA/DASHBOARD.md)
- [Migracoes](./MIGRACOES.md)

