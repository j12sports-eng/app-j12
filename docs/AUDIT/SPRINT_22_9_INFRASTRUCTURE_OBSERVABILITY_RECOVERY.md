# Sprint 22.9 — Infraestrutura, observabilidade, backup e recuperação

Data da auditoria local: 2026-07-11.

## Escopo e evidência

- Branch: `sprint-22`.
- Base inicial: `fb1725b061ae4a16eb1950403bdafca5a501d4e3`.
- Working tree inicial: limpo.
- Auditados somente repositório e documentação local.
- Não houve conexão à VPS, produção, MySQL externo, DNS, Certbot, PM2 remoto ou integrações.
- Não houve deploy, migration, backup real, restore real, commit, push ou tag.
- Sprint 22.10 não iniciada.

Classificações: **comprovado localmente** significa código/configuração inspecionada ou gate local executado; **documentado** não prova implantação; **não comprovado** exige VPS/HML/serviço externo; **bloqueador** impede prontidão produtiva segura.

## Matriz de prontidão

| Área          | Evidência local                                                       | Estado real                                                         | Prontidão |
| ------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------- | --------: |
| VPS AlmaLinux | documentação genérica; scripts são Ubuntu/apt                         | incompatibilidade operacional                                       |       30% |
| PM2           | ecosystems de produção/HML, fork único, autorestart e arquivos de log | configuração existe; implantação e startup boot não comprovados     |       65% |
| Nginx         | templates app/HML com proxy e TLS                                     | `/health` mascara dependências; API dedicada somente HTTP           |       58% |
| HTTPS         | paths Let's Encrypt documentados                                      | emissão, renovação e expiração não testadas                         |       45% |
| SSR           | build/servidor/proxy presentes                                        | sem health próprio e sem graceful shutdown                          |       60% |
| API           | health, request ID, headers, rate limit e shutdown básico             | health degradado retorna 200; bootstrap altera schema em runtime    |       62% |
| Secrets       | exemplos `.env` e ignore                                              | chave/certificado Inter rastreados no Git: bloqueador crítico       |       20% |
| Logs          | console + arquivos PM2                                                | sem logger estruturado, centralização ou rotação comprovada         |       35% |
| Monitoramento | guias parciais para n8n                                               | nenhum coletor/dashboard de runtime comprovado                      |       20% |
| Alertas       | política documental n8n                                               | nenhum canal/alerta de infraestrutura comprovado                    |       15% |
| Deploy        | scripts e documentação                                                | não atômico, mistura instalação/build/restart/config; sem AlmaLinux |       42% |
| Rollback      | comandos Git documentados                                             | não atômico; sem releases/symlink nem ensaio                        |       25% |
| Backup        | exemplo `mysqldump`                                                   | sem automação, retenção, criptografia ou execução comprovada        |       20% |
| Restore       | comando exemplo                                                       | nenhum restore isolado testado                                      |        5% |
| Migrations    | pasta e regras documentadas                                           | sem runner/ledger; JS+SQL misturados; `ensureSchema` em runtime     |       25% |
| CI/CD         | nenhuma configuração raiz encontrada                                  | ausente                                                             |        0% |

Prontidão funcional real da Sprint 22.9: **36%**. O percentual pondera segurança, recuperação e detecção como capacidades críticas e não promove documentação a evidência operacional.

## Respostas operacionais

1. **Deploy:** hoje é manual via Git/npm/PM2; o caminho seguro proposto usa `npm ci`, hash imutável, build prévio, release por diretório e recarga após validação. O mecanismo atômico ainda não existe.
2. **Validar deploy:** conferir hash, artifacts Client/SSR, PM2, Nginx, saúde interna/externa e smoke read-only. O `/health` externo atual não é evidência suficiente.
3. **Detectar falha:** PM2/logs e checks manuais existem; monitor, métricas e alertas automáticos não estão implantados.
4. **Rollback:** documentação usa checkout do hash e rebuild; não é atômico nem ensaiado. Banco exige decisão separada.
5. **Backup:** existe somente exemplo de `mysqldump`; nenhuma execução foi comprovada.
6. **Restaurar:** existe somente comando de import; deve ocorrer em banco isolado e com integrações bloqueadas.
7. **Comprovar restauração:** checksum, import exit 0, mysqlcheck, inventário/contagens/invariantes, mesma release, health e smoke read-only, RPO/RTO medidos.
8. **Logs:** PM2 e arquivos locais; rotação, retenção, busca central e correlação completa estão pendentes.
9. **Reiniciar:** preferir reload e drenagem; API tem fechamento básico, SSR não. Operações financeiras precisam de reconciliação após interrupção.
10. **Secrets:** cofre, arquivos fora do Git, menor privilégio, masking e rotação. A chave Inter versionada deve ser considerada exposta.

## Achados críticos

### Chave privada rastreada

`certs/inter.key` e `certs/inter.crt` constam em `git ls-files`. O conteúdo não foi exibido. Ação obrigatória antes de produção: revogar/rotacionar credenciais e certificados, retirar arquivos do tracking, adicionar política de ignore e limpar histórico em janela coordenada. Apenas apagar o arquivo atual não remove a exposição histórica.

### Health enganoso

Os templates Nginx de app/HML respondem `/health` com `200 ok` estático, mesmo se API, SSR ou banco falharem. A API também responde 200 com estado `degraded`. É necessário separar liveness/readiness e fazer deploy falhar quando banco/schema não estiverem prontos.

### Scripts incompatíveis e amplos

Os scripts são nomeados Ubuntu e usam `apt-get`; a stack informada é AlmaLinux. O deploy SSR executa `npm install`, mata processos da porta (inclusive `kill -9`), altera PM2/Nginx e reinicia Nginx. Isso amplia blast radius e não fornece release atômica ou rollback automático.

### Recuperação não comprovada

Não há job de backup, armazenamento offsite, manifesto, retenção, criptografia, teste periódico de restore ou evidência RPO/RTO. Backup e restore permanecem bloqueadores, apesar dos exemplos documentais.

### Observabilidade insuficiente

Request ID e logs HTTP existem na API, mas o runtime usa `console`; o contrato de logger declara explicitamente não estar integrado. Não há rotação comprovada, métricas, tracing, agregador, SLO ou alertas de infraestrutura implantados.

### Schema no runtime

A API executa `ensureSchema` durante bootstrap e diversos repositories criam/ajustam schema sob demanda, enquanto a documentação de migrations afirma execução manual e sem runner. Isso torna deploy, rollback e tempo de readiness menos previsíveis.

## Melhorias preparadas nesta sprint

- Runbook operacional consolidado em `docs/DEPLOY/RUNBOOK_OPERACIONAL_SPRINT_22_9.md`.
- Procedimentos de deploy, validação, falha, rollback, logs, restart, backup, restore, certificado, secrets e incidente.
- Critérios explícitos para comprovação de restore, sem declarar execução inexistente.
- Inventário de gaps e percentuais conservadores.

As correções de código/configuração para readiness, graceful shutdown, bind PM2 e Nginx foram analisadas, porém não aplicadas porque o mecanismo seguro de patch não conseguiu ler arquivos existentes nesta sessão. Nenhuma escrita alternativa foi usada para contornar o sandbox.

## Bloqueadores de produção

1. Rotação e remoção coordenada das credenciais Inter rastreadas.
2. Backup automatizado, criptografado, offsite e monitorado.
3. Restore real aprovado em ambiente isolado com RPO/RTO medidos.
4. Health/readiness que reflita API, banco/schema e SSR.
5. Deploy AlmaLinux imutável/atômico e rollback ensaiado.
6. Estratégia de migrations com ledger, ordem, checksum e rollback.
7. Graceful shutdown testado, inclusive conexões e operações financeiras.
8. Rotação/centralização de logs, métricas e alertas testados.
9. CI com build, testes, lint, secret scanning e validação de configs.
10. TLS do host dedicado da API e renovação/expiração comprovadas, se o host for usado.

## Pendências de validação

- `nginx -t`, Certbot, PM2 startup/status e firewall requerem VPS autorizada.
- Backup/restore e migration requerem banco isolado/HML e autorização explícita.
- Alertas requerem canal não produtivo ou janela controlada.
- Graceful shutdown/restart precisa de teste com tráfego em voo.
- Nenhuma dessas pendências deve ser marcada como aprovada apenas por existir no runbook.

## Conclusão

O repositório contém uma base operacional útil, mas não está pronto para produção segura em recuperação e observabilidade. PM2, Nginx, SSR e API existem; backup, restore, CI/CD, alertas e releases atômicas não estão comprovados. A Sprint 22.9 não declara 100% e não iniciou a Sprint 22.10.
