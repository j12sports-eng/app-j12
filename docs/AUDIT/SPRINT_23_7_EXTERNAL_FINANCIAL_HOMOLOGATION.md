# Sprint 23.7 — Homologação financeira externa

Data: 2026-07-12. Branch: `sprint-23`. HEAD inicial: `0087f79083e966cec235703863d21d42d2ad59b2`.

## Conclusão executiva

A Sprint 23.7 foi executada exclusivamente como **preparação e auditoria offline**. Não havia comprovação simultânea de HML provisionada, credenciais sandbox autorizadas, declaração explícita de não produção e proteção operacional contra transação real. Nenhum cliente Banco Inter/n8n foi carregado e nenhuma chamada, Pix, webhook, pagamento ou conciliação externa foi realizada.

Resultado correto: **homologação externa não executada e não comprovada**.

## Condições obrigatórias

| Condição                        | Evidência disponível                                            | Resultado                       |
| ------------------------------- | --------------------------------------------------------------- | ------------------------------- |
| HML isolada                     | Sprint 23.6 preparou código, mas não provisionou infraestrutura | ausente                         |
| Credenciais sandbox autorizadas | nenhum secret foi inspecionado ou fornecido                     | ausente                         |
| Confirmação de não produção     | nenhuma autorização operacional `AUTH-HML-*` foi fornecida      | ausente                         |
| Proteção contra transação real  | guardrail preparado, sem validação contra sandbox real          | não comprovada operacionalmente |

Essas ausências bloquearam corretamente qualquer execução externa.

## Auditoria arquitetural

Há dois stacks Banco Inter parcialmente sobrepostos: serviços legados em `backend/src/services/bancoInter` e domínios modernos em `backend/src/domains/financeiro/inter` e `payment/providers/inter`. Ambos foram preservados; esta sprint não criou terceira fonte financeira nem alterou contratos.

Controles encontrados:

- OAuth client credentials, cache de token e renovação;
- mTLS com certificado/chave e `rejectUnauthorized=true`;
- timeout configurável;
- retry limitado após respostas transitórias/autenticação;
- PUT Pix por txid e persistência local idempotente;
- assinatura/token de webhook com comparação constante;
- hash de evento, `INSERT IGNORE` e replay idempotente;
- bloqueio de baixa para pagamento parcial ou valor divergente;
- transação na conciliação de pagamento e espelhos;
- autenticação de serviço, allowlist de origem, rate limit e auditoria nas automações;
- contratos n8n com correlation ID e erros controlados.

Esses itens representam implementação e testes locais, não prova de interoperabilidade externa.

## Matriz dos fluxos obrigatórios

| Fluxo               | Evidência local existente                    | Evidência Sprint 23.7           | Classificação final                    |
| ------------------- | -------------------------------------------- | ------------------------------- | -------------------------------------- |
| Autenticação mTLS   | agent HTTPS e testes com material injetado   | somente auditado                | simulado/local; externo não comprovado |
| Emissão Pix sandbox | payload, txid e cliente PUT                  | não executada                   | não comprovada                         |
| Consulta            | cliente GET e normalização                   | não executada                   | não comprovada                         |
| Timeout             | configuração e testes determinísticos        | não executado em rede           | simulado                               |
| Retry               | uma repetição controlada                     | não executado contra sandbox    | simulado                               |
| Idempotência        | txid/constraints/repositórios                | não medida em sandbox/banco HML | local; externa não comprovada          |
| Webhook válido      | validação e processamento local              | não recebido externamente       | local; externo não comprovado          |
| Webhook inválido    | rejeição de assinatura/token                 | não recebido externamente       | local; externo não comprovado          |
| Replay              | hash e evento processado                     | sem entrega repetida externa    | local; externo não comprovado          |
| Assinatura          | shared secret/timing safe                    | formato real não validado       | local; externo não comprovado          |
| Pagamento parcial   | baixa bloqueada antes da mutation            | sem pagamento sandbox           | comprovado localmente apenas           |
| Valor divergente    | comparação em centavos                       | sem payload sandbox             | comprovado localmente apenas           |
| Conciliação         | repository transacional                      | sem banco HML/pagamento         | não comprovada externamente            |
| Duplicidade         | unique/`INSERT IGNORE`                       | sem concorrência externa        | local; externa não comprovada          |
| Indisponibilidade   | classificação/retry/erro                     | sem falha de sandbox            | simulada                               |
| n8n                 | adapter, serviço, auth/origin/rate limit     | não acionado                    | local; externo não comprovado          |
| Auditoria           | correlation ID, histórico e logs sanitizados | gate gera plano sem secrets     | preparado; trilha externa inexistente  |

## Preparação implementada

O gate `scripts/external-financial-hml` introduz:

1. modo `audit/plan` garantidamente offline;
2. inventário fixo dos 17 cenários, todos marcados `NOT_EXECUTED`;
3. validação da identidade e isolamento herdados da Sprint 23.6;
4. confirmação explícita de credenciais não produtivas;
5. confirmação explícita de bloqueio de transação real;
6. authorization ID no padrão `AUTH-HML-*`;
7. allowlist exata dos hosts sandbox de Inter e n8n;
8. rejeição de hosts conhecidos de produção;
9. exigência de HTTPS e hostname inequivocamente sandbox/HML/UAT/test;
10. secrets externos ao Git e arquivos de certificado/chave existentes;
11. confirmação exata ligada ao instance ID e authorization ID;
12. comando `authorize` que apenas valida, sem executar chamadas.

Mesmo quando esse preflight passa, uma janela operacional humana e um comando específico revisado continuam obrigatórios.

## Cenário operacional futuro

Quando todas as autorizações existirem, a execução deverá registrar por cenário: timestamp, correlation ID, host sanitizado, status HTTP, duração, tentativa, txid sintético, checksum do payload sanitizado, resultado local/externo e cleanup. Nunca registrar tokens, certificados, Pix copia-e-cola, CPF, nomes, e-mail ou telefone.

Ordem segura proposta:

1. validar HML/banco/migrations e massa sintética;
2. validar DNS/TLS e allowlists sem mutation;
3. autenticar via mTLS;
4. emitir cobrança sandbox de valor nominal permitido pelo sandbox;
5. repetir emissão com o mesmo txid;
6. consultar, testar timeout/retry/indisponibilidade;
7. entregar webhooks válido, inválido e replay;
8. testar parcial/divergente e confirmar ausência de baixa;
9. testar pagamento integral/conciliação somente se o sandbox garantir ausência de valor real;
10. executar n8n com destinatários sintéticos e outbound real bloqueado;
11. conferir auditoria e limpar o ambiente descartável.

## Testes locais desta sprint

| Teste                                                   | Resultado |
| ------------------------------------------------------- | --------- |
| Audit offline cobre 17 cenários e não autoriza chamadas | aprovado  |
| Configuração sandbox explícita e confirmação exata      | aprovado  |
| Hosts produtivos Inter/n8n rejeitados                   | aprovado  |
| Confirmações/secrets ausentes falham fechado            | aprovado  |
| Certificado/chave inexistentes bloqueiam autorização    | aprovado  |

Total focado: **5/5**. O comando `audit` foi executado localmente e retornou `externalCalls=false`, `readyForExternalExecution=false` e todos os cenários `NOT_EXECUTED`.

## Gates finais

| Gate                 | Resultado                             |
| -------------------- | ------------------------------------- |
| Gate externo focado  | **5/5 aprovados**                     |
| Regressão financeira | **161/161 aprovados**                 |
| Backend completo     | **589/589 aprovados**                 |
| Frontend completo    | **78/78 aprovados**                   |
| ESLint focado        | **aprovado**                          |
| Prettier focado      | **aprovado**                          |
| `git diff --check`   | **aprovado**                          |
| Build Client/SSR     | **aprovado**, 3.737 módulos no Client |
| Chamadas externas    | **zero**                              |

## Classificação de evidência

| Item                             | Classificação                     |
| -------------------------------- | --------------------------------- |
| Auditoria de código e contratos  | executada localmente              |
| Gate de autorização              | implementado e testado localmente |
| Banco Inter/n8n mocks existentes | simulados; não são E2E            |
| HML real                         | não provisionada/não comprovada   |
| OAuth/mTLS sandbox real          | não executado                     |
| Pix sandbox                      | não emitido                       |
| Webhook externo                  | não recebido                      |
| n8n externo                      | não acionado                      |
| Conciliação em banco HML         | não executada                     |
| Homologação externa E2E          | **0% comprovada**                 |

## Arquivos da Sprint 23.7

- `config/hml/external-financial.env.example`: overlay sem secrets.
- `scripts/external-financial-hml/external-financial-gate.cjs`: autorização fail-closed.
- `scripts/external-financial-hml/j12-external-financial.cjs`: audit, plan e authorize sem chamadas.
- `scripts/external-financial-hml/external-financial-gate.test.cjs`: testes do gate.
- `scripts/external-financial-hml/README.md`: instruções operacionais.
- `docs/AUDIT/SPRINT_23_7_EXTERNAL_FINANCIAL_HOMOLOGATION.md`: este relatório.

## Percentual real

- auditoria e preparação offline: **100%**;
- guardrails locais: **100%**;
- infraestrutura/credenciais autorizadas: **0% comprovado**;
- execução Banco Inter/Pix/webhook/n8n: **0%**;
- homologação financeira externa E2E: **0%**.

Nenhuma ação da Sprint 23.8 foi iniciada. Não houve commit, push, tag, migration, banco externo, chamada HTTP externa ou transação financeira.
