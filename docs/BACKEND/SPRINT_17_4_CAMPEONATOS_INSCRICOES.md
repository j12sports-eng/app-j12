# Sprint 17.4 - Inscricao de Equipes no Campeonato

## Objetivo

Implementar o relacionamento administrativo entre Campeonato e Equipe para inscricao, consulta, listagem, cancelamento e atualizacao de status.

Fora do escopo: atletas, jogos, grupos, tabelas, sumulas, estatisticas e portal publico.

## APIs

Base:

- `/admin/campeonatos`
- `/api/admin/campeonatos`

Endpoints:

- `GET /inscricoes?championshipId=&status=&search=&page=&limit=&sortBy=&sortDirection=`
- `GET /:championshipId/inscricoes`
- `GET /inscricoes/:registrationId`
- `GET /inscricoes/equipes-disponiveis?championshipId=&search=&page=&limit=&sortBy=&sortDirection=`
- `POST /inscricoes`
- `PATCH /inscricoes/:registrationId/status`
- `PATCH /inscricoes/:registrationId`
- `POST /inscricoes/:registrationId/cancelar`
- `DELETE /inscricoes/:registrationId`

## Payloads

Criar inscricao:

```json
{
  "championshipId": "camp-1",
  "teamId": "team-1",
  "observations": "Pagamento pendente",
  "confirm": false
}
```

Atualizar status:

```json
{
  "status": "CONFIRMED",
  "observations": "Conferencia aprovada"
}
```

## Status

- `PENDING` - Pendente.
- `CONFIRMED` - Confirmada.
- `REFUSED` - Recusada.
- `CANCELLED` - Cancelada.

## Validacoes

- Bloqueia equipe duplicada no mesmo campeonato.
- Valida categoria da equipe contra categoria do campeonato.
- Valida modalidade da equipe contra modalidade do campeonato.
- Valida limite maximo por `championship.maxTeams`, `metadata.maxTeams`, `metadata.limiteEquipes` ou `metadata.teamLimit`.
- Bloqueia campeonatos encerrados ou cancelados.

## Autorizacao

Mantido exatamente o padrao atual do modulo:

- `requireAuth`
- `canManageSystem`

Nenhum sistema novo de permissoes foi criado.
