# Checkpoint — Sprint 23.1F

**Data do registro:** 12/07/2026
**Status:** IMPLEMENTAÇÃO CONCLUÍDA / HOMOLOGAÇÃO PARCIAL / BLOQUEADA POR DEPENDÊNCIA EXTERNA DO MYSQL
**Branch de desenvolvimento:** `sprint-23`
**Commit implementado:** `966aac135616d2f8945b606495e5dd1f1af74afb`

## 1. Objetivo

Endurecer a estratégia de conectividade e reconexão MySQL para impedir tempestades de tentativas durante indisponibilidade do banco, especialmente diante de erros permanentes como `ER_HOST_IS_BLOCKED`.

## 2. Causa raiz técnica

O teste de conexão anterior utilizava contador global, recursão e retry indiscriminado de até dez tentativas.

Isso permitia que erros permanentes, como host bloqueado, credenciais inválidas ou banco inexistente, gerassem backoff e novas tentativas inúteis.

Também foram identificados:

- chamadas concorrentes iniciando cadeias independentes;
- keepalive SQL executando `SELECT 1` periodicamente;
- health checks podendo multiplicar tentativas durante indisponibilidade;
- logs contendo a mensagem original do erro;
- ausência de classificação explícita entre erros permanentes, transitórios e desconhecidos.

## 3. Implementações concluídas

- Classificação explícita de erros permanentes, transitórios e desconhecidos.
- Retry somente para allowlist de erros transitórios.
- Limite padrão de três tentativas totais.
- `DB_MAX_RECONNECT_ATTEMPTS` limitado entre 1 e 5.
- `testConnection()` convertido para loop iterativo.
- Contador local por execução.
- Single-flight para chamadas concorrentes.
- Liberação da conexão em `finally`.
- Logs de conectividade sanitizados.
- Keepalive SQL desativado por padrão.
- `DB_KEEPALIVE_ENABLED` para habilitação explícita.
- `DB_KEEPALIVE_INTERVAL_MS` com limites defensivos.
- Proteção contra sobreposição do keepalive.
- Cooldown padrão de 30 segundos para health checks.
- `DB_HEALTH_RETRY_COOLDOWN_MS` com limites defensivos.
- Single-flight compartilhado entre startup, health e login precheck.
- Fluxo login-precheck preservado.
- Nenhum retry automático em queries ou transações de negócio.

## 4. Arquivos alterados

- `backend/src/config/db.js`
- `backend/src/config/database-connectivity.js`
- `backend/src/config/database-connectivity.test.js`
- `server/index.mjs`
- `server/database-health.mjs`
- `server/database-health.test.mjs`

## 5. Validações concluídas

- Testes específicos da Sprint 23.1F: **14/14 aprovados**.
- Sintaxe dos módulos críticos: **PASS**.
- Build local anterior: **PASS**.
- `git diff --check`: **PASS**.
- Código enviado ao GitHub: **SIM**.
- Código sincronizado na homologação: **SIM**.
- `.env` da homologação preservado e validado por hash: **SIM**.
- Certificados do Banco Inter preservados e validados: **SIM**.

## 6. Estado da homologação

Código sincronizado na VPS no commit:

`966aac135616d2f8945b606495e5dd1f1af74afb`

Processos identificados:

- `j12-api-hml` — porta `3002`.
- `j12-frontend-hml` — porta `4174`.

O código foi sincronizado, mas os processos PM2 ainda não foram reiniciados com o novo código após a sincronização.

## 7. Bloqueio externo

O servidor MySQL remoto está bloqueando o IP da VPS:

`69.6.222.40`

Erro observado:

- Código: `ER_HOST_IS_BLOCKED`
- Errno: `1129`

A resolução depende da hospedagem responsável pelo servidor MySQL remoto.

## 8. Etapas pendentes da Sprint 23.1F

Quando a homologação for retomada:

1. Executar `npm run build` na homologação.
2. Confirmar sucesso do build.
3. Validar `dist/client`.
4. Validar `dist/server`.
5. Reiniciar somente `j12-api-hml`.
6. Confirmar novo PID da API.
7. Confirmar porta `3002`.
8. Inspecionar logs da API.
9. Confirmar ausência de tempestade de retries.
10. Validar health check da API.
11. Reiniciar somente `j12-frontend-hml`.
12. Confirmar novo PID do frontend.
13. Confirmar porta `4174`.
14. Validar o domínio de homologação.
15. Após o desbloqueio do MySQL, confirmar recuperação real e health HTTP 200.

## 9. Backup e recuperação

Backup crítico pré-deploy:

`/var/backups/j12-sports/pre-deploy-sprint-23.1F-20260712-161223`

Diretório temporário de preservação:

`/root/j12-hml-preserve.Hodd2q`

## 10. Confirmações

- Produção não foi alterada.
- Nginx não foi alterado.
- Nenhuma migration foi executada.
- Nenhum segredo foi exposto.
- `.env` da homologação foi preservado.
- Certificados do Banco Inter foram preservados.

## 11. Estado oficial da Sprint 23.1F

**IMPLEMENTAÇÃO CONCLUÍDA / HOMOLOGAÇÃO PARCIAL / BLOQUEADA POR DEPENDÊNCIA EXTERNA DO MYSQL**

É permitido avançar para o próximo escopo de desenvolvimento sem considerar a homologação real da Sprint 23.1F definitivamente concluída.

Quando o MySQL for desbloqueado, retomar a partir da seção **Etapas pendentes da Sprint 23.1F**.

---

**Fim do checkpoint da Sprint 23.1F.**
