# Sprint 22.7 — Homologação Financeira E2E

Data: 2026-07-11.

## Escopo e base auditada

- Branch: `sprint-22`.
- Commit base anterior à Sprint 22.7: `ee46eabc7b5d3d2b71cf320e7039f51ac6b2e160` (`ee46eab`).
- Estado inicial desta retomada: seis arquivos modificados e um documento não rastreado, todos auditados antes da primeira edição.
- Estado final: sete arquivos da Sprint 22.7 permanecem no working tree, sem commit.
- Restrições preservadas: nenhuma cobrança, Pix, pagamento, webhook externo, sincronização Banco Inter, migration, automação n8n, alteração de credencial, deploy ou operação Git destrutiva foi executada.
- As Sprints 22.1–22.6 foram preservadas. A única falha encontrada fora do escopo não foi corrigida.

### Estado inicial registrado

```text
branch: sprint-22
HEAD: ee46eabc7b5d3d2b71cf320e7039f51ac6b2e160
modified: 6
untracked: 1
diff inicial: 6 files changed, 148 insertions(+)
```

Arquivos modificados no início:

- `backend/src/domains/financeiro/inter/application/services/inter-application.service.js`
- `backend/src/domains/financeiro/inter/application/tests/inter-application.service.test.js`
- `backend/src/domains/financeiro/inter/presentation/controllers/inter-admin.controller.js`
- `backend/src/domains/financeiro/payment/providers/inter/payment-provider-inter.js`
- `backend/src/domains/financeiro/payment/providers/inter/services/webhook.service.js`
- `backend/src/domains/financeiro/payment/providers/inter/tests/payment-provider-inter.test.js`

Arquivo não rastreado no início:

- `docs/AUDIT/SPRINT_22_7_FINANCIAL_E2E_HOMOLOGATION.md`

## Legenda das evidências

- **Comprovado localmente:** gate executado no working tree sem serviço externo.
- **Comprovado por testes isolados:** comportamento validado com doubles, repositórios in-memory ou query runners injetados; não prova banco ou provedor real.
- **Simulado/mockado:** contrato exercitado sem a integração real.
- **Não comprovado:** existe estrutura, mas não há evidência operacional suficiente nesta homologação.
- **Bloqueado por HML/ambiente externo:** exige banco controlado, sandbox, certificado, webhook ou automação externa não autorizados nesta Sprint.

## Descoberta arquitetural e bloqueio E2E

O repositório `MySqlEnrollmentFinancialObligationRepository` toca exclusivamente `enrollment_financial_obligations`. O próprio contrato e seus testes rejeitam acesso a `j12_mensalidades`, `j12_financeiro_cobrancas`, `j12_pagamentos` e `financial_payments`.

Não foi encontrado serviço, adaptador, evento, job ou composição que materialize automaticamente uma obrigação moderna em mensalidade ou cobrança legada. Portanto:

```text
matrícula → enrollment_financial_obligations → [LACUNA] → j12_mensalidades/j12_financeiro_cobrancas
```

Essa ausência impede comprovar o ciclo financeiro completo. Nenhuma integração, fallback, mock ou automação foi criada para mascarar a lacuna.

## Matriz financeira E2E

| Fluxo                            | Evidência observada                                                                   | Classificação                                       | Resultado/limite                                        |
| -------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------- |
| Matrícula                        | domínio Enrollment, facade, service e repository                                      | Comprovado por testes isolados                      | criação e vínculo interno cobertos; banco HML não usado |
| Obrigação financeira             | `FinancialApplicationService`, repository e unique `(enrollment_id, obligation_type)` | Comprovado por testes isolados                      | criação/reuso/status cobertos                           |
| Obrigação → mensalidade/cobrança | busca integral não encontrou adaptador                                                | Não comprovado e bloqueio real                      | interrompe o E2E canônico                               |
| Mensalidade                      | serviços legados geram e consultam `j12_mensalidades`                                 | Comprovado por testes isolados                      | fonte paralela, não originada pela obrigação moderna    |
| Cobrança                         | geração e consulta em `j12_financeiro_cobrancas`                                      | Comprovado por testes isolados                      | sem dado HML controlado                                 |
| Criação de Pix                   | provider/client, OAuth e mTLS injetáveis                                              | Simulado/mockado                                    | nenhuma chamada Banco Inter foi feita                   |
| Pagamento local                  | `financial_payments`, txid unique e espelhos legados                                  | Comprovado por testes isolados                      | persistência real não executada                         |
| Pagamento parcial/divergente     | comparação monetária em centavos antes de `reconcilePayment`                          | Comprovado por testes isolados                      | baixa bloqueada sem mutation                            |
| Webhook                          | validação de segredo/mTLS, normalização e processamento                               | Comprovado por testes isolados e transporte mockado | payload real do Inter depende de HML                    |
| Idempotência                     | txid unique, PUT por txid, hash de evento e histórico derivado do txid                | Comprovado por testes isolados                      | constraints implantadas não verificadas                 |
| Duplicidade                      | `INSERT IGNORE`, evento processado e reuso de obrigação                               | Comprovado por testes isolados                      | concorrência real não medida                            |
| Retry                            | uma renovação/repetição após HTTP 401                                                 | Simulado/mockado                                    | sandbox não usado                                       |
| Timeout                          | cliente configurável e Scenario Runner determinístico                                 | Simulado/mockado                                    | rede real não usada                                     |
| Conciliação                      | status do Inter atualiza pagamento e espelhos                                         | Comprovado por testes isolados                      | sem payload ou banco HML                                |
| Baixa transacional               | transaction runner atualiza `financial_payments`, cobrança, mensalidade e histórico   | Comprovado por testes isolados                      | rollback/locks reais não comprovados                    |
| Inadimplência                    | vencimento, ausência/data de pagamento e percentuais                                  | Comprovado por testes isolados                      | números reais não validados                             |
| Automações                       | janelas, idempotência, falha e reprocessamento                                        | Comprovado por testes isolados; integração mockada  | n8n/canais não acionados                                |
| Relatórios                       | saldo, parcelas, Pix, automações e exportadores                                       | Comprovado por testes isolados                      | volume e dados HML pendentes                            |
| BI financeiro                    | agregações sobre cobranças conciliadas                                                | Comprovado por testes isolados/estrutura            | coerência de dados reais pendente                       |
| BI de inadimplência              | cálculo agregado e filtros                                                            | Comprovado por testes isolados/estrutura            | timezone, volume e dados reais pendentes                |

## Bug financeiro encontrado e corrigido

### Baixa integral indevida por valor divergente

Webhook e consulta/sincronização podiam receber status pago e marcar cobrança/mensalidade integralmente como pagas sem comparar o valor recebido com o valor esperado. Como pagamento parcial não é suportado, um valor divergente podia quitar toda a dívida.

A correção preservada e validada:

- normaliza valor esperado e recebido em centavos;
- compara somente quando o status normalizado é pago;
- rejeita valor inválido, negativo, parcial ou divergente;
- executa a validação antes de `reconcilePayment` nos dois stacks Banco Inter;
- mantém webhook divergente não processado;
- mapeia os erros controlados para HTTP 409;
- adiciona testes garantindo zero reconciliações/mutations.

Limite mantido intencionalmente: payload pago sem campo de valor ainda depende do contrato/autenticidade do Banco Inter. Exigir esse campo sem confirmar o payload oficial em HML poderia rejeitar webhooks válidos; a decisão permanece bloqueada por homologação externa.

## Banco Inter, segurança e resiliência

- OAuth usa client credentials, cache e renovação antes da expiração.
- mTLS carrega certificado, chave e CA, com `rejectUnauthorized` ativo.
- O cliente possui timeout configurável e um retry após 401 com renovação do token.
- A emissão usa PUT idempotente por txid e persistência local com unique de txid.
- O webhook valida segredo quando configurado; sem segredo, depende do mTLS da infraestrutura.
- Eventos repetidos usam hash e `INSERT IGNORE`.
- A sincronização isola falhas por pagamento aberto.
- Cancelado, expirado e devolvido não são tratados como pagos.
- Pagamento parcial/divergente falha fechado antes da baixa.

Todos esses itens foram auditados em código e testes. OAuth, mTLS, retry, timeout e transporte do webhook continuam simulados.

## Testes e gates executados

| Gate                            | Resultado                      | Observação                                                                   |
| ------------------------------- | ------------------------------ | ---------------------------------------------------------------------------- |
| Testes focados Inter/Payment    | **38/38 aprovados**            | inclui os quatro cenários novos de valor parcial/divergente                  |
| Regressão do domínio Financeiro | **157/157 aprovados**          | todos os testes sob `backend/src/domains/financeiro`                         |
| Regressão Banco Inter/Payment   | **aprovada**                   | contida nas suítes de 38 e 157 testes                                        |
| Backend completo                | **536/537 na execução global** | uma falha intermitente preexistente da Sprint 22.2; teste isolado passou 5/5 |
| Frontend completo               | não configurado                | não existe script de teste frontend no `package.json`                        |
| ESLint direcionado              | **aprovado**                   | seis arquivos JavaScript alterados                                           |
| Prettier direcionado            | **aprovado após formatação**   | código e este relatório                                                      |
| `git diff --check`              | **aprovado**                   | sem erro de whitespace                                                       |
| Build Client                    | **aprovado**                   | Vite gerou `dist/client`                                                     |
| Build SSR                       | **aprovado**                   | Vite gerou `dist/server`                                                     |

### Falha preexistente fora do escopo

Na suíte backend global, `backend/src/security/tests/sprint-22-2.security.test.js` falhou uma vez ao alterar somente o último caractere Base64URL de um JWT. Dependendo dos bits não significativos da codificação, essa troca pode preservar os mesmos bytes e não invalidar a assinatura. O mesmo arquivo passou isoladamente (`5/5`). Nenhum arquivo da Sprint 22.2 foi alterado, conforme a restrição de não corrigir problemas preexistentes fora do escopo.

## Arquivos da Sprint 22.7

### Modificados

- `backend/src/domains/financeiro/inter/application/services/inter-application.service.js` — valida valor recebido antes da conciliação por consulta, sync e webhook.
- `backend/src/domains/financeiro/inter/application/tests/inter-application.service.test.js` — cobre consulta e webhook com pagamento parcial.
- `backend/src/domains/financeiro/inter/presentation/controllers/inter-admin.controller.js` — converte divergência monetária em conflito HTTP 409.
- `backend/src/domains/financeiro/payment/providers/inter/payment-provider-inter.js` — protege consulta/sync do provider antes da baixa.
- `backend/src/domains/financeiro/payment/providers/inter/services/webhook.service.js` — protege webhook do provider antes da baixa.
- `backend/src/domains/financeiro/payment/providers/inter/tests/payment-provider-inter.test.js` — cobre provider e webhook com valores divergentes.

### Criado

- `docs/AUDIT/SPRINT_22_7_FINANCIAL_E2E_HOMOLOGATION.md` — matriz, evidências, gates e bloqueadores desta Sprint.

## Pendências e bloqueadores

### Pendências internas

- Definir e implementar, em Sprint autorizada, o adaptador canônico de obrigação para mensalidade/cobrança.
- Definir fonte canônica entre obligations, mensalidades, cobranças, `j12_pagamentos` e `financial_payments`.
- Definir tratamento operacional de pagamentos parciais, atualmente recusados de forma segura.
- Corrigir em escopo próprio o teste JWT intermitente da Sprint 22.2.

### Pendências externas/HML

- Validar schema, migrations aplicadas, unique keys, engine, collation, timezone e rollback transacional em banco isolado.
- Confirmar payload real de cobrança paga e presença/formato do valor no webhook Banco Inter.
- Validar OAuth, mTLS, certificado, timeout, retry e idempotência contra sandbox autorizado.
- Exercitar concorrência e duplicidade de webhook/txid com dados controlados.
- Validar n8n e canais externos somente em ambiente homologado e com destinatários de teste.
- Validar relatórios, BI, inadimplência e performance com massa HML conhecida.

### Bloqueadores para homologação E2E

1. Ausência da transição automática `enrollment_financial_obligations` → `j12_mensalidades`/`j12_financeiro_cobrancas`.
2. Ausência de banco HML isolado e massa financeira controlada nesta execução.
3. Banco Inter sandbox/mTLS/webhook real não homologados.
4. Fontes financeiras paralelas ainda sem fonte canônica única.

### Bloqueadores para produção

Todos os bloqueadores de HML acima, mais:

- aceite de negócio para pagamento parcial e divergente;
- comprovação de observabilidade, alertas, conciliação operacional e reprocessamento;
- ensaio de rollback/recuperação e verificação de consistência entre todas as tabelas espelho;
- aprovação explícita após homologação integrada, sem uso de credenciais ou valores reais durante este gate.

## Percentual funcional real

**74% funcional no nível local/isolado; 0% do ciclo E2E completo comprovado.**

O percentual local considera 14 de 19 capacidades solicitadas com comportamento funcional comprovado por testes isolados. Não considera como funcionais reais a ponte obrigação → mensalidade/cobrança nem os quatro aspectos dependentes de ambiente externo (criação Pix real, webhook real, retry real e timeout real). O ciclo completo recebe 0% porque a cadeia é interrompida pela lacuna arquitetural antes da cobrança.

## Conclusão

A Sprint 22.7 fortalece corretamente a segurança da baixa: pagamento parcial ou divergente não quita cobrança, mensalidade ou histórico. Os 38 testes focados e os 157 testes do domínio Financeiro passam, e Client/SSR compilam. Entretanto, a homologação Financeira E2E não pode ser aprovada: falta a transição canônica entre obrigação moderna e cobrança/mensalidade, e as integrações reais dependem de HML autorizado.
