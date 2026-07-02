# Financial Admin Frontend Go-live Checklist

## Escopo

Tela administrativa:

```text
/admin/financeiro
```

Painel:

```text
src/features/financial/pages/FinancialAdminEnrollmentPanel.tsx
```

## Estado

```text
UI administrativa real criada
go-live parcial alinhado ao backend
```

## Validacoes visuais

Confirmar:

```text
rota exige usuario autenticado
rota aceita admin/coordenador
consulta por enrollmentId
busca por nome/CPF/e-mail/ids do aluno
consulta por studentPersonId/studentProfileId
status PREPARED renderizado
status PENDING renderizado
status PAID renderizado
status OVERDUE renderizado
status CANCELLED renderizado
acoes bloqueadas durante loading
transicoes invalidas desabilitadas
erro da API exibido sem stack trace
empty state exibido sem quebrar layout
```

## Acoes guardadas

Permitidas pela UI:

```text
PREPARED/PENDING/OVERDUE -> PAID
PREPARED/PENDING/OVERDUE -> CANCELLED
PREPARED/PENDING -> OVERDUE
```

Bloqueadas pela UI:

```text
PAID -> qualquer alteracao
CANCELLED -> qualquer alteracao
OVERDUE -> OVERDUE
```

O backend permanece como fonte final de validacao.

## API

Client:

```text
src/features/financial/api/financial.api.ts
```

Base URL:

```text
src/lib/api.ts
```

Nao ha URL hardcoded.

## Fora do escopo

```text
gateway
Pix
boleto
cartao
pagamento externo
notificacao
agenda
schema
migrations
mobile
```

## Validacoes

```bash
cmd /c npm run build
npx tsc --noEmit --pretty false
npx eslint src/features/financial/api/financial.api.ts src/features/financial/types/financial.types.ts src/features/financial/hooks/useEnrollmentFinancialObligations.ts src/features/financial/hooks/useStudentFinancialSummary.ts src/features/financial/hooks/useFinancialObligationActions.ts src/features/financial/components/FinancialStatusBadge.tsx src/features/financial/components/FinancialObligationCard.tsx src/features/financial/pages/FinancialAdminEnrollmentPanel.tsx src/routes/admin/financeiro.tsx
```

## Riscos

```text
go-live completo depende do contrato financeiro resolver plano/valor/vencimento
lint global do repositorio segue com pendencias preexistentes fora desta tela
```
