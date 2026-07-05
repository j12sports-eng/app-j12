# Sprint 16 - Frontend Quadras

## Rota

`/admin/quadras`

Arquivo: `src/routes/admin/quadras.tsx`

Pagina: `src/features/quadras/pages/CourtRentalAdminPage.tsx`

## Estrutura

- `src/features/quadras/api/court-rental.api.ts`
- `src/features/quadras/hooks/useCourtRental.ts`
- `src/features/quadras/pages/CourtRentalAdminPage.tsx`
- `src/features/quadras/types/quadras.types.ts`

## Abas

- Dashboard
- Calendario
- Reservas
- Quadras
- Disponibilidade
- Clientes
- Lista de espera
- Bloqueios
- Relatorios
- Auditoria

## Fluxos

- Criar reserva avulsa ou recorrente.
- Criar cliente avulso durante a reserva.
- Validar conflitos pelo backend.
- Gerar cobranca no financeiro quando habilitado.
- Confirmar pagamento pelo painel.
- Cancelar reserva e permitir promocao automatica da lista de espera.
- Duplicar reserva.
- Adicionar locatario manualmente na lista de espera por quadra e horario desejado.
- Ajustar duracao em incrementos de 30 minutos.
- Arrastar reserva no calendario para trocar a data mantendo horario.
- Criar e encerrar bloqueios administrativos.
- Exportar relatorios em CSV, Excel e PDF.

## Dados e cache

React Query usa a chave base `["quadras", "locacao"]` e invalida todas as consultas do dominio apos mutacoes operacionais.

Consultas principais:

- `useCourts`
- `useReservations`
- `useCourtAvailability`
- `useCourtBlocks`
- `useCourtWaitlist`
- `useCourtReports`
- `useCourtAudit`

## Responsividade

A pagina usa `AppShell`, `ProtectedRoute`, `SkeletonDashboard`, TailwindCSS e layout mobile-first com grids que colapsam para uma coluna em telas pequenas.

## Observacoes

O calendario usa drag and drop nativo do navegador para mover reservas entre datas. O resize e operacional por botoes de `-30min` e `+30min`, mantendo validacao de disponibilidade no backend.
