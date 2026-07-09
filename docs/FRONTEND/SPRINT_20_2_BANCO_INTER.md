# Sprint 20.2 - Frontend Banco Inter

## Objetivo

Integrar a administracao financeira ao backend Banco Inter da Sprint 20.2 sem expor regras de
gateway no frontend.

O frontend cria a cobranca financeira local e, quando a forma de pagamento e Pix, solicita ao
backend a emissao do Pix Banco Inter pelo endpoint administrativo novo.

## Arquitetura final

Arquivos principais:

- `src/routes/admin/financeiro.tsx`;
- `src/hooks/useFinanceiroAdmin.ts`;
- `src/components/financeiro/movement-modal/FinancialMovementModal.tsx`;
- `src/components/financeiro/movement-modal/movement-form.ts`;
- `src/components/financeiro/create-charge/CreateChargeModal.tsx`;
- `src/components/financeiro/create-charge/ChargeSummary.tsx`;
- `src/features/financial/api/financial.api.ts`;
- `src/features/financial/hooks/useEnrollmentFinancialObligations.ts`;
- `src/features/financial/hooks/useFinancialObligationActions.ts`;
- `src/features/financial/hooks/useFinancialStudentScopeSearch.ts`;
- `src/features/financial/hooks/useStudentFinancialSummary.ts`;
- `src/features/financial/pages/FinancialAdminEnrollmentPanel.tsx`;
- `src/features/financial/tests/financial-banco-inter.frontend.test.mjs`.

## Fluxo de criacao Pix

1. Usuario abre a pagina `/admin/financeiro`.
2. `FinancialMovementModal` monta uma receita/cobranca.
3. `useFinanceiroAdmin.criarCobranca` chama `POST /financeiro/cobrancas`.
4. Se `gerarPix = true` e `formaPagamento = pix`, o hook chama:

```http
POST /admin/financeiro/inter/pix
```

5. O backend resolve OAuth, mTLS, Pix, persistencia e conciliacao.
6. O frontend recebe o payload do Pix e o repassa ao fluxo de WhatsApp ja existente.
7. A tela recarrega os dados financeiros.

## Endpoint Banco Inter usado pelo frontend

Criacao de Pix:

```json
POST /api/admin/financeiro/inter/pix
{
  "chargeId": "cob-123",
  "mensalidadeId": "cob-123"
}
```

Resposta consumida:

```json
{
  "provider": "banco_inter",
  "txid": "TXID123",
  "bancoInter": {
    "txid": "TXID123",
    "pixCopiaCola": "000201...",
    "qrCode": "data:image/png;base64,...",
    "linkPagamento": "https://..."
  },
  "pagamento": {
    "status": "PENDENTE"
  }
}
```

O frontend nao chama diretamente:

- OAuth Banco Inter;
- API externa do Banco Inter;
- mTLS;
- webhook;
- conciliacao.

## APIs administrativas financeiras

`src/features/financial/api/financial.api.ts` mantem contratos internos:

- listar obrigacoes por matricula;
- resumo financeiro por escopo de aluno;
- busca de escopo financeiro de aluno;
- marcar obrigacao como paga;
- cancelar obrigacao;
- marcar obrigacao como vencida.

Essas APIs continuam independentes da emissao Pix Banco Inter.

## Hooks

Hooks do painel financeiro:

- `useFinanceiroAdmin`;
- `useEnrollmentFinancialObligations`;
- `useStudentFinancialSummary`;
- `useFinancialStudentScopeSearch`;
- `useFinancialObligationActions`.

`useFinancialObligationActions` invalida automaticamente:

- `enrollmentFinancialObligationsQueryKey`;
- `studentFinancialSummaryQueryKey`.

`useFinanceiroAdmin` sincroniza a tela por eventos realtime:

- `financeiro:cobranca-atualizada`;
- `financeiro:pagamento-atualizado`;
- `dashboard:financeiro-atualizado`.

## Componentes

Componentes de fluxo financeiro:

- `FinancialMovementModal`: modal real usado pela pagina administrativa;
- `CreateChargeModal`: wizard preparado para fluxo em etapas;
- `ChargeSummary`: exibe resumo e copia Pix quando o payload existe;
- `FinancialAdminEnrollmentPanel`: painel de obrigacoes financeiras por matricula/aluno;
- `FinancialStatusBadge`;
- `FinancialObligationCard`.

## Pagina e rota

Rota principal:

```tsx
createFileRoute("/admin/financeiro")
```

Redirecionamento por perfil:

```tsx
createFileRoute("/financeiro")
```

Administradores e coordenadores sao enviados para `/admin/financeiro`.

## Estados validados

Loading:

- `LoadingState` em `/admin/financeiro`;
- skeletons em `FinancialMovementModal`;
- `Loader2` em consultas e acoes do painel de obrigacoes.

Empty:

- nenhuma mensalidade;
- nenhuma despesa;
- nenhum aluno encontrado;
- nenhuma obrigacao carregada.

Error:

- erro geral da pagina financeira;
- erro de busca de aluno;
- erro de resumo/obrigacoes;
- erro de submit exibido via `formatApiErrorMessage`.

## Decisoes tecnicas

- O frontend nao duplica regras de conciliacao.
- O frontend nao guarda credenciais Banco Inter.
- O frontend nao conhece certificados mTLS.
- O frontend usa o endpoint administrativo novo da Sprint 20.2 para Pix.
- O endpoint legado `/pix/create` nao e usado pelo frontend financeiro.
- A invalidacao de queries fica nos hooks de acoes financeiras.
- A sincronizacao de dashboard continua por eventos realtime existentes.

## Testes

Teste criado:

- `src/features/financial/tests/financial-banco-inter.frontend.test.mjs`.

Cobertura:

- API;
- hooks;
- componentes;
- pagina;
- rota;
- sincronizacao;
- invalidacao automatica;
- estados `loading`, `empty` e `error`;
- ausencia de segredos OAuth/mTLS no frontend;
- uso de `/admin/financeiro/inter/pix`.

Comando:

```bash
node --test src/features/financial/tests/financial-banco-inter.frontend.test.mjs
```

## Pendencias

Nao ha pendencias funcionais de frontend no dominio Financeiro para a Sprint 20.2.
