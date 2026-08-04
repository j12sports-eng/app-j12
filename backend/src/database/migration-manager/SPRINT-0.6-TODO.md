# PendÃªncias para concluir oficialmente a Sprint 0.6

Quando o ambiente de desenvolvimento estiver disponÃ­vel novamente:

1. Revisar os arquivos parcialmente criados pelo Codex.
2. Confirmar que o adoption manifest representa exatamente o banco real.
3. Concluir o `auth-legacy-preflight`.
4. Concluir guards contra novas dependÃªncias canÃ´nicas em `j12_usuarios`.
5. Concluir formatter e README.
6. Executar:
   - `npm test`
   - testes focados da Sprint 0.6
   - `node --check`
   - Prettier
   - `git diff --check`
7. Executar apenas comandos `--dry-run` contra o banco.
8. NÃ£o executar baseline ou migration real antes da revisÃ£o dos resultados.
