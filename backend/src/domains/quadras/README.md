# Dominio Quadras

Modulo administrativo de Locacao de Quadras implementado na Sprint 16.

## Escopo

- Cadastro e edicao de quadras, fotos, dimensoes, capacidade, cobertura, iluminacao, status, limites de duracao e horarios de funcionamento.
- Disponibilidade por periodo com bloqueios administrativos, feriados, manutencoes e horarios exclusivos para aulas.
- Reservas avulsas e recorrentes, remarcacao, cancelamento, confirmacao automatica e lista de espera.
- Validacao de conflito por reserva e bloqueio antes da gravacao.
- Calculo automatico por preco base, preco noturno, preco de fim de semana e regras por dia/horario, com desconto e estrutura de cupom.
- Cadastro de locatarios, historico de reservas e integracao de cobranca no financeiro quando permitido.
- Notificacoes internas e eventos realtime reutilizando a infraestrutura ja existente.
- Auditoria de operacoes administrativas.

## Endpoints administrativos

Base: `/admin/quadras` e `/api/admin/quadras`.

- `GET /` e `POST /`: lista e cria quadras.
- `GET /:courtId`, `PUT /:courtId`: consulta e edita uma quadra.
- `GET /:courtId/precos`, `POST /:courtId/precos`: regras de preco.
- `GET /locatarios`, `POST /locatarios`: locatarios.
- `GET /reservas`, `POST /reservas`: reservas.
- `POST /reservas/cotacao`: cotacao de valor.
- `PATCH /reservas/:reservationId`, `PATCH /reservas/:reservationId/reagendar`: alteracao e remarcacao.
- `PATCH /reservas/:reservationId/pagamento`: confirmacao de pagamento e baixa espelhada no financeiro.
- `POST /reservas/:reservationId/duplicar`: duplicacao operacional da reserva.
- `DELETE /reservas/:reservationId/cancelar`: cancelamento.
- `GET /disponibilidade`, `POST /disponibilidade/validar`: calendario e validacao em tempo real.
- `GET /bloqueios`, `POST /bloqueios`: bloqueios de disponibilidade.
- `PATCH /bloqueios/:blockId`, `DELETE /bloqueios/:blockId`: edicao e encerramento de bloqueio.
- `GET /lista-espera`, `POST /lista-espera`: lista de espera.
- `POST /lista-espera/:waitlistId/promover`: promove o primeiro interessado quando a vaga fica disponivel.
- `GET /relatorios`: ocupacao, receita, cancelamentos, horarios e clientes frequentes.
- `GET /relatorios/exportar?format=csv|excel|pdf`: exportacao de relatorio.
- `GET /auditoria`: trilha de auditoria.

## Persistencia

O projeto atual nao possui Prisma configurado no runtime. Para preservar compatibilidade, o modulo segue o padrao vigente do backend: MySQL direto via `backend/src/config/db.js`.

As tabelas `j12_quadras`, `j12_locatarios`, `j12_quadra_price_rules`, `j12_quadra_reservas`, `j12_quadra_bloqueios`, `j12_quadra_waitlist` e `j12_quadra_audit_logs` sao criadas de forma idempotente pelo service antes do uso.

Campos aditivos de `j12_quadras`: `capacidade`, `coberta`, `iluminacao`, `preco_noturno`, `preco_fim_semana`, `tempo_minimo_minutos` e `tempo_maximo_minutos`.
