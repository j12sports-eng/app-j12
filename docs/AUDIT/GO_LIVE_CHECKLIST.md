# Checklist pré-go-live — J12 Sports

Marcar READY somente com evidência anexada. Estado atual:

| Item                     | Estado  | Evidência necessária/atual                            |
| ------------------------ | ------- | ----------------------------------------------------- |
| Código aprovado          | PARTIAL | regressão passa; lint falha                           |
| Testes aprovados         | PARTIAL | 616/616 locais; sem E2E real                          |
| Build aprovado           | READY   | Client/SSR exit code 0                                |
| Migrations conhecidas    | BLOCKED | sem ledger/schema HML                                 |
| Backup disponível        | BLOCKED | nenhum job/artefato comprovado                        |
| Restore validado         | BLOCKED | nenhum restore isolado aprovado                       |
| Rollback documentado     | PARTIAL | runbook existe; ensaio ausente                        |
| Secrets configurados     | BLOCKED | chave/certificado Inter rastreados                    |
| HTTPS                    | PARTIAL | templates existem; VPS/certificados não validados     |
| Health check             | BLOCKED | readiness pode mascarar degradação                    |
| Logs                     | PARTIAL | arquivos PM2/console; rotação ausente                 |
| Monitoramento            | BLOCKED | métricas/alertas não implantados                      |
| Integrações externas     | BLOCKED | Inter/Pix/webhook/n8n não homologados                 |
| Usuários administrativos | BLOCKED | contas/2FA/menor privilégio não validados em HML      |
| Permissões               | PARTIAL | guards locais aprovados; browser multiusuário ausente |
| Dados iniciais           | BLOCKED | seed/massa HML e reconciliação não aprovados          |
| Smoke pós-deploy         | PARTIAL | plano criado; execução não autorizada                 |
| P0 zerados               | BLOCKED | três P0 abertos                                       |
| P1 homologados           | BLOCKED | múltiplos P1 abertos                                  |
| Aceite formal            | BLOCKED | decisão atual NOT READY                               |

Critério de GO: todos os BLOCKED resolvidos, evidência datada, owner e ticket; P0=0; P1 produtivos aprovados em HML; rollback/restore/smoke ensaiados.
