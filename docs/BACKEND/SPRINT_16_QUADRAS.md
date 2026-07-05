# Sprint 16 - Backend Quadras

## Escopo

Dominio: `backend/src/domains/quadras`.

Base administrativa: `/admin/quadras`, montada tambem pelos prefixos globais `/api` e `/__api` conforme bootstrap do backend.

## Fluxo

Quadra -> disponibilidade -> reserva -> financeiro -> agenda/notificacoes -> relatorios -> auditoria.

## Rotas

| Metodo   | Rota                                               | Finalidade                                       |
| -------- | -------------------------------------------------- | ------------------------------------------------ |
| `GET`    | `/admin/quadras`                                   | Lista quadras                                    |
| `POST`   | `/admin/quadras`                                   | Cria quadra                                      |
| `GET`    | `/admin/quadras/:courtId`                          | Detalha quadra                                   |
| `PUT`    | `/admin/quadras/:courtId`                          | Atualiza quadra                                  |
| `GET`    | `/admin/quadras/:courtId/precos`                   | Lista regras de preco                            |
| `POST`   | `/admin/quadras/:courtId/precos`                   | Cria/atualiza regra de preco                     |
| `GET`    | `/admin/quadras/locatarios`                        | Lista clientes/locatarios                        |
| `POST`   | `/admin/quadras/locatarios`                        | Cria cliente avulso                              |
| `GET`    | `/admin/quadras/reservas`                          | Lista reservas por periodo/status                |
| `POST`   | `/admin/quadras/reservas`                          | Cria reserva avulsa ou recorrente                |
| `POST`   | `/admin/quadras/reservas/cotacao`                  | Calcula valor                                    |
| `PATCH`  | `/admin/quadras/reservas/:reservationId`           | Atualiza status/observacao                       |
| `PATCH`  | `/admin/quadras/reservas/:reservationId/reagendar` | Reagenda reserva                                 |
| `PATCH`  | `/admin/quadras/reservas/:reservationId/pagamento` | Confirma pagamento                               |
| `POST`   | `/admin/quadras/reservas/:reservationId/duplicar`  | Duplica reserva                                  |
| `DELETE` | `/admin/quadras/reservas/:reservationId/cancelar`  | Cancela reserva e tenta promover lista de espera |
| `GET`    | `/admin/quadras/disponibilidade`                   | Retorna slots, reservas e bloqueios              |
| `POST`   | `/admin/quadras/disponibilidade/validar`           | Valida conflito, funcionamento e duracao         |
| `GET`    | `/admin/quadras/bloqueios`                         | Lista bloqueios                                  |
| `POST`   | `/admin/quadras/bloqueios`                         | Cria bloqueio                                    |
| `PATCH`  | `/admin/quadras/bloqueios/:blockId`                | Atualiza bloqueio                                |
| `DELETE` | `/admin/quadras/bloqueios/:blockId`                | Encerra bloqueio                                 |
| `GET`    | `/admin/quadras/lista-espera`                      | Lista fila                                       |
| `POST`   | `/admin/quadras/lista-espera`                      | Adiciona fila                                    |
| `POST`   | `/admin/quadras/lista-espera/:waitlistId/promover` | Promove fila para reserva                        |
| `GET`    | `/admin/quadras/relatorios`                        | Receita, ocupacao e clientes frequentes          |
| `GET`    | `/admin/quadras/relatorios/exportar`               | Exporta `csv`, `excel` ou `pdf`                  |
| `GET`    | `/admin/quadras/auditoria`                         | Lista trilha administrativa                      |

## Payloads

Quadra aceita:

```json
{
  "nome": "Quadra Principal",
  "tipo": "Futsal",
  "capacidade": 12,
  "coberta": true,
  "iluminacao": true,
  "precoBase": 180,
  "precoNoturno": 220,
  "precoFimSemana": 200,
  "tempoMinimoMinutos": 60,
  "tempoMaximoMinutos": 180,
  "status": "ativa"
}
```

Reserva aceita recorrencia semanal com multiplos dias ou mensal:

```json
{
  "courtId": "quadra-principal",
  "renterId": "loc-1",
  "startAt": "2026-07-06T19:00:00",
  "endAt": "2026-07-06T20:00:00",
  "paymentMethod": "pix",
  "generateCharge": true,
  "allowWaitlist": true,
  "recurrence": {
    "frequency": "weekly",
    "daysOfWeek": ["seg", "qui"],
    "interval": 1,
    "until": "2026-08-31"
  }
}
```

Lista de espera manual:

```json
{
  "courtId": "quadra-principal",
  "renterId": "loc-1",
  "desiredStartAt": "2026-07-06T19:00:00",
  "desiredEndAt": "2026-07-06T20:00:00",
  "reason": "Horario ocupado"
}
```

## Banco

Tabelas gerenciadas pelo service:

- `j12_quadras`
- `j12_locatarios`
- `j12_quadra_price_rules`
- `j12_quadra_reservas`
- `j12_quadra_bloqueios`
- `j12_quadra_waitlist`
- `j12_quadra_audit_logs`

Colunas aditivas de quadras: `capacidade`, `coberta`, `iluminacao`, `preco_noturno`, `preco_fim_semana`, `tempo_minimo_minutos`, `tempo_maximo_minutos`.

## Integracoes

- Financeiro: cria/atualiza `j12_financeiro_cobrancas` quando a tabela existe.
- Agenda/Notificacoes: registra eventos em `agenda_notification_events` e `agenda_notifications` quando as tabelas existem.
- Realtime: emite `quadras:reservas-atualizadas` e `nova_notificacao` quando `global.io` existe.

## Validacoes

- Status da quadra precisa estar `ativa`.
- Inicio precisa ser anterior ao fim.
- Duracao precisa respeitar minimo/maximo da quadra.
- Horario precisa estar dentro do funcionamento.
- Reservas e bloqueios ativos nao podem sobrepor a janela solicitada.
