# Smoke test pós-deploy — J12 Sports

Executar após deploy autorizado. Usar HML primeiro e dados sintéticos; não usar Pix/Inter/n8n reais como smoke.

## Infraestrutura

- [ ] Hash/release implantada corresponde ao aprovado.
- [ ] PM2 sem restart loop; API/SSR em loopback.
- [ ] Nginx config válido; HTTPS e certificado corretos.
- [ ] Liveness e readiness comprovam API, banco/schema e SSR.
- [ ] Logs sem secrets, 5xx recorrente ou erro de bootstrap.

## Jornadas read-only e seguras

- [ ] Admin autentica e abre dashboard.
- [ ] Admin consulta aluno, responsável, matrícula, turma e obrigação.
- [ ] Professor consulta turma e presença sem escrever fora do escopo.
- [ ] Aluno consulta dados próprios.
- [ ] Responsável consulta somente dependente vinculado.
- [ ] Admin consulta agenda, quadras, campeonatos, BI, relatórios e histórico.
- [ ] Portal público exibe campeonato sanitizado.

## Mutations controladas em HML

- [ ] Criar aluno sintético e vincular responsável.
- [ ] Criar matrícula, turma e obrigação; validar rollback/limpeza.
- [ ] Registrar presença sintética e bloquear acesso cruzado.
- [ ] Criar reserva e confirmar bloqueio de conflito/pagamento cancelado.
- [ ] Criar campeonato sintético e publicar no portal.

## Financeiro

- [ ] Ponte obrigação→cobrança homologada.
- [ ] Pagamento apenas em sandbox, valor mínimo e autorização específica.
- [ ] Webhook assinado, idempotência, divergência, conciliação e histórico validados.
- [ ] n8n/canais usam destinatários de teste e allowlist.

## Critérios

Falha em readiness, ownership, financeiro, migration ou integridade aciona rollback. Preservar request IDs, logs, horários e hash. Não repetir pagamento/webhook sem reconciliar efeito anterior. Smoke aprovado exige todas as evidências anexadas e aceite do responsável operacional.
