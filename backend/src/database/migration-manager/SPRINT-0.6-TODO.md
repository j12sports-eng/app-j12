# Checklist de conclusão da Sprint 0.6

## Validações concluídas

1. [x] Revisar os arquivos parcialmente criados pelo Codex.
2. [x] Confirmar que o adoption manifest representa o estado observado do banco real.
3. [x] Concluir e validar o `auth-legacy-preflight`.
4. [x] Concluir guards contra novas dependências canônicas em `j12_usuarios`.
5. [x] Concluir formatter e README.
6. [x] Executar validações locais:
   - `npm test`;
   - testes focados da Sprint 0.6;
   - `node --check`;
   - Prettier;
   - `git diff --check`.
7. [x] Executar `plan`, `baseline --dry-run` e `apply-one --dry-run` contra o banco real.
8. [x] Revisar os resultados sem executar baseline ou migration real.

## Resultado

A validação técnica da Sprint 0.6 foi concluída.

O `baseline --dry-run` propôs exclusivamente:

`20260712184500_create_auth_runtime_tables`

A migration corretiva:

`20260803133000_reconcile_auth_runtime_charset_collation`

foi validada por `apply-one --dry-run`, com preflight operacional seguro e risco `LOW`, mas permanece bloqueada por `DEPENDENCY_NOT_APPLIED`.

Nenhum `baseline --write` ou `apply-one --write` foi executado.

## Próxima etapa

Qualquer alteração do ledger ou execução de migration no banco real exige uma nova decisão operacional explícita, backup previamente confirmado e novo dry-run imediatamente antes da operação.
