# Runbook de Rollback — J12 Sports

> Documento operacional. Rollback é uma mudança de produção e exige autorização. Rollback de aplicação, banco, migration, PM2, Nginx, DNS e certificados são operações independentes; não devem ser combinadas automaticamente.

## 1. Identificação e comando da resposta

Antes de agir:

- declarar incidente e congelar novas mudanças;
- registrar horário, release atual/anterior, SHA, sintomas, métricas e impacto;
- nomear Incident Commander, operador, DBA, infraestrutura e comunicação;
- preservar logs e artefatos sem registrar secrets ou dados pessoais;
- decidir entre observar, mitigar, rollback de aplicação ou contingência específica.

## 2. Quando executar rollback

Rollback de aplicação é indicado quando há relação temporal forte com a release e pelo menos um dos itens:

- readiness/liveness ou smoke não estabiliza;
- aumento sustentado de 5xx, latência, uso de memória/CPU ou reinícios;
- fluxo crítico indisponível ou regressão confirmada;
- falha de assets/SSR/proxy incompatível com correção imediata segura;
- erro de segurança/exposição introduzido pela release;
- critério de abort previamente definido foi atingido.

Não executar rollback cego quando a causa for banco, DNS, TLS, rede, provedor externo ou dados incompatíveis. Nesses casos, seguir a seção correspondente e manter owner especializado.

## 3. Avaliação obrigatória antes do rollback

- [ ] A release anterior existe, está construída e foi validada anteriormente.
- [ ] Compatibilidade da release anterior com o schema atual foi confirmada pelo DBA.
- [ ] Nenhuma migration destrutiva ou mudança de dados impede retorno da aplicação.
- [ ] Jobs, webhooks e escritas concorrentes foram avaliados antes de qualquer ação de banco.
- [ ] Comando, release alvo, confirmação e plano de retorno foram revisados por duas pessoas.
- [ ] Usuários e stakeholders receberam comunicação apropriada.

## 4. Rollback da aplicação

O fluxo canônico troca o symlink, recarrega PM2, executa readiness e restaura o estado original se o alvo falhar:

```bash
sudo -u j12 J12_DEPLOY_CONFIG=/etc/j12-sports/deploy.conf \
  bash deploy/almalinux/rollback.sh \
  --release-id=<RELEASE_ANTERIOR> \
  --confirm=ROLLBACK:<RELEASE_ANTERIOR>
```

Depois:

- confirmar `current` e processos PM2 apontando para a release anterior;
- confirmar que o script informou `migrations=untouched`;
- não remover a release defeituosa até encerrar investigação;
- não executar `git checkout`, `git reset` ou substituir arquivos dentro da release ativa.

## 5. Rollback do banco

Restore de banco **não é** rollback normal de aplicação. Só considerar quando houver corrupção/perda de dados comprovada e decisão conjunta de DBA, segurança, negócio e Incident Commander.

Antes de restaurar:

- interromper ou isolar writers, jobs, webhooks e integrações;
- delimitar ponto no tempo e perda de dados aceitável;
- preservar snapshot/backup do estado incidente;
- validar checksum, manifesto, cadeia de custódia e compatibilidade da release;
- calcular impacto financeiro e plano de reconciliação;
- preferir primeiro restore em ambiente descartável e validação integral.

O utilitário do repositório recusa restore em nome não descartável. Ele serve para drill/validação e não autoriza restore de produção. Restore produtivo exige procedimento específico do DBA, aprovação formal e plano de point-in-time recovery quando disponível.

## 6. Rollback das migrations

- Nunca executar `DOWN` automaticamente.
- Nunca assumir que rollback de aplicação reverte schema.
- Classificar cada migration como aditiva/compatível, reversível por forward-fix ou dependente de restore.
- Se o schema for compatível, manter a migration e retornar somente a aplicação.
- Se houver erro corrigível, preferir migration forward-only revisada e testada.
- Se houver perda/corrupção, seguir o processo de restore/PITR, com reconciliação.
- Registrar checksum, ledger, estado `APPLIED/FAILED`, locks e decisão do DBA.

## 7. Rollback do PM2

Use o script canônico sempre que possível. Para diagnóstico:

- confirmar `PM2_HOME`, usuário de serviço e path imutável de cada processo;
- verificar que `j12-api` e `j12-frontend` usam o ecosystem da release alvo;
- usar reload controlado, permitindo SIGTERM e graceful shutdown;
- não usar `kill -9` enquanto a janela de drenagem não expirar;
- confirmar `pm2 save` somente após saúde estável;
- validar persistência da unit systemd sem alterar configuração durante o incidente.

Se PM2 não recuperar, manter Nginx sem enviar tráfego ao upstream defeituoso e escalar para contingência; não iniciar entrypoint legado.

## 8. Rollback do Nginx

Aplicável somente quando o incidente foi causado por mudança Nginx:

1. preservar arquivo atual e evidência do erro;
2. restaurar a versão aprovada anterior;
3. executar `sudo nginx -t`;
4. somente com sintaxe válida, executar reload controlado conforme procedimento do host;
5. validar HTTPS, health, API, SSR e WebSocket.

Nunca recarregar configuração que falhou no `nginx -t`. Rollback Nginx não muda aplicação, schema ou DNS.

## 9. Rollback do DNS, quando aplicável

DNS é mudança externa separada:

- confirmar que o incidente está na resolução/target e não na aplicação;
- registrar TTL, valores anterior/atual, propagation window e owner do provedor;
- restaurar exatamente o registro anterior por operador autorizado;
- não reduzir segurança nem apontar para host não homologado;
- acompanhar resolução por múltiplos resolvedores autorizados até o TTL;
- manter TLS válido para o hostname durante toda a transição.

Propagation não é instantânea; mantenha ambos os destinos seguros durante a janela.

## 10. Rollback de certificados

- Não restaurar chave historicamente exposta ou revogada.
- Confirmar que certificado anterior ainda é válido, corresponde à chave e cobre todos os SANs.
- Preservar permissões 600/640 e owner correto.
- Atualizar somente paths aprovados em storage compartilhado.
- Validar cadeia e `nginx -t` antes do reload.
- Confirmar HTTPS, HSTS e alerta de expiração após a troca.
- Se nenhum certificado anterior for seguro/válido, acionar emissão emergencial; não liberar HTTP como fallback.

## 11. Validação pós-rollback

- [ ] `current`, SHA, PM2 e artefatos correspondem à release alvo.
- [ ] API `/live`, `/ready` e `/health` estão verdes.
- [ ] SSR `/live`, `/ready` e `/ssr/health` estão verdes.
- [ ] TLS, Nginx, proxy API, auth e WebSocket funcionam.
- [ ] Login e fluxos críticos read-only passam com conta controlada.
- [ ] Escritas, migrations e reconciliações necessárias foram avaliadas pelo owner.
- [ ] 5xx, latência, memória, CPU, pool, disco e reinícios estabilizaram.
- [ ] Logs não mostram nova falha e permanecem sanitizados.
- [ ] Monitoramento permanece verde pela janela de observação acordada.
- [ ] Usuários/stakeholders foram comunicados.

## 12. Encerramento

Somente encerrar quando serviço estiver estável, dados reconciliados e risco residual aceito. Anexar timeline, causa preliminar, decisões, comandos sanitizados, evidências e ações corretivas. A release defeituosa não volta à produção sem nova revisão completa.
