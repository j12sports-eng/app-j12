# Runbook de produção — J12 Sports

Este plano não autoriza deploy. Executar somente com aprovação, janela, operadores e evidências.

## Pré-deploy

1. Confirmar checklist GO, P0=0, hash aprovado e working tree limpo.
2. Confirmar HML, 616 testes, lint baseline aprovado e Client/SSR.
3. Confirmar backup offsite com checksum e restore recente dentro do RPO/RTO.
4. Validar secrets no cofre, certificado Inter rotacionado, TLS, firewall e contas.
5. Registrar release anterior, plano de rollback, responsáveis e canais de incidente.

## Deploy proposto

- AlmaLinux: usar automação `dnf` aprovada; não executar scripts Ubuntu existentes.
- Criar diretório imutável por hash, executar `npm ci` e build antes do tráfego.
- Validar artifacts e configuração sem imprimir secrets.
- Trocar symlink atomicamente e usar `pm2 startOrReload` com ambiente aprovado.
- Executar `nginx -t` antes de reload; nunca aplicar `kill -9` no fluxo normal.
- Validar liveness/readiness internas antes de liberar tráfego.

## Rollback

1. Congelar mudanças, registrar sintomas/hash e preservar logs.
2. Se banco não mudou, apontar symlink à release anterior e recarregar PM2.
3. Se migration ocorreu, não executar DOWN automaticamente; usar plano aprovado.
4. Restaurar banco somente com autorização, backup validado e reconciliação financeira.
5. Executar smoke read-only e registrar decisão.

## Backup e restore

- Dump consistente com `--single-transaction`, routines/triggers/events, compressão e checksum.
- Armazenamento criptografado fora da VPS, retenção e owner definidos.
- Restore somente em MySQL isolado, integrações/jobs bloqueados.
- Comprovar schema, constraints, contagens, invariantes, health, mesma release e RPO/RTO.
- Checksum prova arquivo; apenas restore e validações provam recuperabilidade.

## Operação

Monitorar PM2, 5xx, latência, banco, filas, disco, TLS, backups e eventos financeiros. Alertas devem possuir owner, severidade, deduplicação e canal testado. Reconciliar toda operação financeira após interrupção.
