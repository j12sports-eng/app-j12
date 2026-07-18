# Sprint 27.17A.4.1 — Validação Operacional MySQL e Gate de Unicidade de CPF

## Resultado

O gate zero foi executado e não encontrou ambiente MySQL seguro e isolado. Nenhum banco, host remoto, migration ou DDL foi acessado. A validação física permanece `NOT_EXECUTED` e a decisão de unicidade permanece `BLOCKED`.

Esta é uma conclusão operacional objetiva, não uma simulação de MySQL. Foram entregues o avaliador determinístico, testes, SQL read-only e roteiro para homologação futura.

## Ambiente observado

```text
environmentType=unavailable
databaseHostCategory=remote-configured-but-not-authorized
databaseNameCategory=unknown-not-recorded
mysqlVersion=unknown
schemaUsed=none
isProduction=unknown-for-remote-target
containsRealPII=unknown
```

Como produção e PII não puderam ser excluídas no alvo remoto, ele foi tratado como proibido. Localmente, Docker, CLI, serviço MySQL/MariaDB e porta 3306 estavam indisponíveis.

## Validações operacionais

| Validação                             | Resultado      |
| ------------------------------------- | -------------- |
| Migration em MySQL real               | `NOT_EXECUTED` |
| Schema e tipos físicos                | `NOT_EXECUTED` |
| Índices e cardinalidade               | `NOT_EXECUTED` |
| Backfill físico                       | `NOT_EXECUTED` |
| Reexecução/idempotência física        | `NOT_EXECUTED` |
| Retomada física                       | `NOT_EXECUTED` |
| Múltiplos `NULL` no MySQL             | `NOT_EXECUTED` |
| Duplicidade sintética no MySQL        | `NOT_EXECUTED` |
| Status contra MySQL                   | `NOT_EXECUTED` |
| Rollback contra MySQL                 | `NOT_EXECUTED` |
| Locks, warnings e tamanho dos índices | `NOT_EXECUTED` |

As mesmas propriedades continuam cobertas por testes automatizados com query runner fake da A.4, mas não são apresentadas como evidência física.

## Gate determinístico

`person-cpf-uniqueness-gate.js` recebe somente evidências agregadas, exige tipos explícitos e retorna lista fechada de blockers. Não consulta banco, não recebe PII e não cria constraint.

Estado desta execução:

```json
{
  "state": "NOT_EXECUTED",
  "decision": "BLOCKED"
}
```

Os blockers completos e critérios de desbloqueio estão em `docs/PESSOAS/CPF_UNIQUENESS_OPERATIONAL_GATE.md`.

## SQL operacional

`docs/SQL/PESSOAS_IDENTITY_UNIQUENESS_GATE.sql` contém apenas `SELECT`, `SHOW` e `EXPLAIN`. Retorna metadados e contagens agregadas, nunca CPF, e-mail, telefone ou nome. A normalização de backfill continua pertencendo ao JavaScript canônico; o SQL não declara equivalência.

## Regra de negócio e writers

O schema confirma tecnicamente Pessoa global e CPF opcional, mas não confirma que a tabela seja exclusivamente Pessoa Física ou que duplicidade nunca seja legítima para inativos/cenários futuros. Há SQL direto conhecido e writers desconhecidos; como `cpf_normalized` é nullable, um writer não sincronizado pode burlar um futuro unique.

O caminho recomendado é migrar todos os writers de CPF e tornar fisicamente impossível gravar CPF original sem normalizado correspondente, em especificação própria. Não foi criado trigger, generated column ou unique.

## Medições

Não há duração de migration, backfill, locks, warnings ou tamanho de índice porque não houve execução MySQL. Tempos dos testes automatizados são métricas de Node/fake e não podem ser extrapolados para produção.

## Proteção de PII

- nenhuma credencial, host, usuário ou nome de banco foi registrado;
- nenhum teste de conexão remota foi feito;
- fixtures existentes nos testes são sintéticas;
- o SQL operacional não retorna valores de identidade;
- o avaliador aceita apenas flags e contagem de grupos.

## Próximo passo

Disponibilizar MySQL isolado e autorizado, executar o roteiro operacional e anexar evidências agregadas. Se todos os blockers forem eliminados, a A.4.2 poderá especificar e aplicar o unique. Enquanto isso, A.4.2 e a criação concorrente da A.5 permanecem bloqueadas.
