# Sprint 23.1 — Remediação de credenciais

## Estado

Retomada em `sprint-23`, HEAD/base `02a436e28bc13b53e384f8d9d2dfe0c4143c48c2`, working tree inicialmente limpo. Nenhum valor secreto é reproduzido aqui.

## P0 e correções no HEAD candidato

- `certs/inter.key` e `certs/inter.crt` estavam rastreados desde `3405cf041e1dee08d1308c1d0e3967b9ec6d7c53`. Foram removidos do índice, preservados localmente e cobertos pelo `.gitignore`.
- `backend/.env.example` tinha `DB_PASSWORD` não vazio e não reconhecido como placeholder. O valor não foi registrado e foi substituído por placeholder falso.
- JWT já falhava sem secret; agora também rejeita placeholders comuns, sem fallback hardcoded.
- Banco Inter falha sem credenciais. mTLS agora impede `rejectUnauthorized: false` e rejeita conteúdo sem envelope PEM esperado.
- Mensagens controladas não incluem tokens, secrets, certificados ou chaves.

A correção do HEAD não limpa commits antigos nem comprova rotação/revogação.

## Alcance Git conhecido

Branches locais afetadas: `backup-sprint-20.3-20260709`, `homolog`, `main`, `sprint-20.3`, `sprint-20.4`, `sprint-21`, `sprint-22`, `sprint-23` e `sprint-6`.

Tags locais afetadas: `sprint-21-final` e `v1.0-architecture-approved`.

O remote configurado é `origin`. Somente sua configuração local foi inventariada; refs e conteúdo hospedados não foram buscados/auditados. Não há evidência de que o remote esteja limpo.

## Pendências externas obrigatórias

1. Rotacionar/revogar no Banco Inter o material potencialmente comprometido e implantar novas credenciais por canal seguro.
2. Auditar GitHub, clones, forks, caches, CI/CD e logs.
3. Planejar, com autorização explícita, reescrita coordenada de todas as refs afetadas, tratamento das tags, force-push e novo clone dos consumidores.
4. Comprovar por refs/objetos que o histórico antigo deixou de ser alcançável.

Nenhuma rotação, revogação, limpeza de histórico ou correção remota é declarada concluída.

## Testes e bloqueadores

Testes focados cobrem JWT ausente/placeholder, OAuth sem credenciais, validação TLS obrigatória, conteúdo mTLS inválido sem vazamento e regressões existentes de OAuth/Pix/segurança.

Homologação exige testes, lint e builds finais aprovados, além de configuração segura. Produção permanece bloqueada até evidência de rotação/revogação, auditoria remota e decisão coordenada sobre limpeza do histórico.
