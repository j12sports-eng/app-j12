# Tabelas

Catalogo das principais tabelas identificadas.

## Indice

- [Autenticacao](#autenticacao)
- [Alunos e Matriculas](#alunos-e-matriculas)
- [Catalogos](#catalogos)
- [Financeiro](#financeiro)
- [Portais](#portais)
- [Snapshots](#snapshots)
- [Legadas](#legadas)
- [Links Relacionados](#links-relacionados)

## Autenticacao

- `users`.
- `j12_usuarios`.
- `user_sessions`.
- `password_reset_tokens`.

## Alunos e Matriculas

- `j12_alunos`.
- `j12_alunos_responsaveis`.
- `j12_alunos_enderecos`.
- `j12_alunos_documentos`.
- `j12_alunos_esportes`.
- `j12_alunos_saude`.
- `j12_alunos_estrategico`.
- `j12_matricula_numeros`.
- `j12_matriculas_publicas`.

## Catalogos

- `j12_planos`.
- `j12_modalidades`.
- `j12_unidades`.
- `j12_turmas`.
- `j12_professores`.
- `j12_responsaveis`.
- `j12_responsavel_alunos`.

## Financeiro

- `j12_financeiro_cobrancas`.
- `j12_mensalidades`.
- `j12_pagamentos`.
- `financial_payments`.
- `inter_webhook_events`.
- Tabela de despesas e criada em rota financeira conforme `backend/routes/financeiro.js`.

## Portais

- `student_presencas`.
- `student_contracts`.
- `student_notifications`.

## Snapshots

- `j12_collection_snapshots`: guarda colecoes como `settings`, `contratos`, `trial-classes`, `turmas`, `planos`, `professores`.

## Legadas

- `alunos`.
- `financeiro`.

Essas tabelas sao mantidas para compatibilidade e sincronizacao.

## Links Relacionados

- [Modelo](./MODELO.md)
- [Pessoas](./PESSOAS.md)
- [Indices](./INDICES.md)

