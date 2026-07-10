# Sprint 21.6 - BI de Inadimplência e Cobranças

Endpoint administrativo `GET /api/admin/bi/delinquency`, protegido por `requireAuth` e `canManageSystem`; frontend em `/admin/bi/inadimplencia`.

`j12_financeiro_cobrancas` é a única fonte monetária, preservando a decisão da Sprint 21.3. Mensalidades, pagamentos, obrigação de matrícula, Pix, conciliação e automações não são somados. Uma cobrança está vencida na data de referência quando `vencimento <= fim do período` e não foi paga até essa data. Status cancelado/cancelada/anulado/anulada e despesas são excluídos.

- Valor vencido: soma de `COALESCE(valor_final, valor)` das cobranças vencidas.
- Obrigações vencidas: `COUNT(DISTINCT cobrança.id)`.
- Inadimplentes únicos: `COUNT(DISTINCT aluno_id)`.
- Taxa de inadimplência: valor vencido / carteira elegível × 100.
- Recuperado: cobrança paga após o vencimento cuja data de pagamento está no período.
- Taxa de recuperação: valor recuperado / (valor recuperado + valor ainda vencido) × 100.
- Aging: diferença em dias entre fim do período e vencimento nas faixas 1–7, 8–15, 16–30, 31–60, 61–90 e acima de 90.

A evolução agrupa o estoque vencido pela competência temporal do vencimento; não afirma reconstruir snapshots históricos. O payload é agregado e não expõe nomes, CPF, telefone, e-mail, Pix payload, txid, e2eid ou credenciais. Quatro consultas agregadas independentes são executadas em paralelo, parametrizadas e read-only. Nenhuma alteração foi feita nos domínios Financeiro, Banco Inter, Payment ou automações; a Sprint 21.7 não foi iniciada.
