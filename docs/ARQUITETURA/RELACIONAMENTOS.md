# Relacionamentos

Mapa dos relacionamentos de dominio identificados no codigo atual.

## Indice

- [Visao Geral](#visao-geral)
- [Entidades Principais](#entidades-principais)
- [Aluno](#aluno)
- [Financeiro](#financeiro)
- [Autenticacao](#autenticacao)
- [Portais](#portais)
- [Observacoes de Integridade](#observacoes-de-integridade)
- [Links Relacionados](#links-relacionados)

## Visao Geral

```mermaid
erDiagram
  J12_ALUNOS ||--o| J12_ALUNOS_RESPONSAVEIS : possui
  J12_ALUNOS ||--o| J12_ALUNOS_ENDERECOS : possui
  J12_ALUNOS ||--o| J12_ALUNOS_DOCUMENTOS : possui
  J12_ALUNOS ||--o| J12_ALUNOS_ESPORTES : possui
  J12_ALUNOS ||--o| J12_ALUNOS_SAUDE : possui
  J12_ALUNOS ||--o{ J12_FINANCEIRO_COBRANCAS : gera
  J12_ALUNOS ||--o{ J12_MENSALIDADES : possui
  J12_ALUNOS ||--o{ STUDENT_PRESENCAS : registra
  J12_ALUNOS ||--o{ STUDENT_CONTRACTS : assina
  J12_RESPONSAVEIS ||--o{ J12_RESPONSAVEL_ALUNOS : vincula
  J12_ALUNOS ||--o{ J12_RESPONSAVEL_ALUNOS : vincula
  USERS ||--o{ USER_SESSIONS : abre
```

## Entidades Principais

- Alunos: `j12_alunos` e tabela legada `alunos`.
- Responsaveis: `j12_responsaveis`, `j12_alunos_responsaveis`, `j12_responsavel_alunos`.
- Professores: `j12_professores`.
- Turmas: `j12_turmas`.
- Planos: `j12_planos`.
- Modalidades: `j12_modalidades`.
- Unidades: `j12_unidades`.
- Financeiro: `j12_financeiro_cobrancas`, `j12_mensalidades`, `j12_pagamentos`, `financial_payments`.
- Auth: `users`, `j12_usuarios`, `user_sessions`, `password_reset_tokens`.

## Aluno

O aluno e a entidade central do sistema. `backend/src/controllers/alunos.controller.js` monta leituras com joins para responsavel, endereco, documentos, esportes, saude e estrategico.

Campos importantes:

- `id`.
- `numero_matricula`.
- `nome_completo`.
- `data_nascimento`.
- `status`.
- `modalidade_principal`.
- `turma_principal`.
- `plano_principal`.
- `matricula_snapshot_json`.

## Financeiro

```mermaid
flowchart TD
  Plano[j12_planos] --> Aluno[j12_alunos]
  Aluno --> Cobranca[j12_financeiro_cobrancas]
  Cobranca --> Mensalidade[j12_mensalidades]
  Mensalidade --> Pagamento[j12_pagamentos]
  Cobranca --> Pix[financial_payments]
  Pix --> Webhook[inter_webhook_events]
```

## Autenticacao

`users` e `j12_usuarios` convivem. `backend/auth.js` normaliza usuario e papel, cria sessoes JWT e resolve escopo de aluno.

## Portais

- Portal aluno: endpoints `/aluno/me/*`.
- Portal responsavel: endpoints `/responsavel/*` e `/responsavel/me/*`.
- Portal professor: frontend usa rotas de turmas, alunos por turma e presencas.

## Observacoes de Integridade

- Muitos relacionamentos sao logicos, nao FKs fisicas.
- Alguns arrays ficam em JSON (`turmas_json`, `unidades_json`, `aluno_ids_json`).
- Existem espelhos e sincronizacoes entre tabelas legadas e `j12_*`.

## Links Relacionados

- [Modelo Pessoa](./MODELO_PESSOA.md)
- [Banco Modelo](../BANCO/MODELO.md)
- [Banco Integridade](../BANCO/INTEGRIDADE.md)

