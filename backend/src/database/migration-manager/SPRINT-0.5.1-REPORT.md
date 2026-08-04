# Sprint 0.5.1 — Correção da adoção auditada do Auth Runtime

## Causa raiz

A fixture fiel do estado confirmado reproduziu uma fonte real de falso positivo: MySQL 5.7 pode
serializar tipos inteiros com display width, como `bigint(20) unsigned`, enquanto o manifesto
declara `bigint unsigned`. A comparação literal classificava essa representação como
`COLUMN_MISMATCH` e contaminava o estado estrutural.

A policy de adoção também tinha duas lacunas:

- reconhecia apenas igualdade textual, rejeitando `utf8mb3` quando a exceção declarava `utf8`;
- verificava se cada diferença observada era permitida, mas não exigia que as seis diferenças
  declaradas estivessem todas presentes.

`REQUIRED_ARTIFACT_MISSING` só pode ser originado por findings estruturais de tabela, coluna,
índice ou FK. Ele não é mais inferido de table options. O catálogo já filtrava findings por
`migrationId`; a própria policy de adoção agora também faz esse isolamento defensivamente.

## Classificação antes/depois

Antes, uma representação equivalente de MySQL 5.7 podia resultar em `DRIFT_DETECTED`,
`STRUCTURAL_DRIFT`, `ARTIFACT_MISMATCH` e `PHYSICAL_STATE_NOT_PRESENT`.

Depois, a fixture confirmada produz:

```json
{
  "physicalState": "TABLE_OPTION_DRIFT",
  "structuralDrift": false,
  "formalDrift": true,
  "requiredArtifactsMissing": [],
  "artifactMismatches": [],
  "tableOptionDifferences": [
    "users.charset",
    "users.collation",
    "user_sessions.charset",
    "user_sessions.collation",
    "password_reset_tokens.charset",
    "password_reset_tokens.collation"
  ]
}
```

## Resultado da adoção

A adoção aceita somente o conjunto completo de seis diferenças, fechado por:

- migration ID e checksum;
- tabela e propriedade;
- valor atual normalizado;
- valor esperado;
- presença da corretiva no catálogo;
- dependência formal da corretiva para a histórica;
- ausência integral de drift estrutural.

`utf8` e `utf8mb3` são aliases. Nenhum deles é normalizado para `utf8mb4`.

## Baseline dry-run esperado

```json
{
  "writesPerformed": false,
  "registrations": [
    {
      "id": "20260712184500_create_auth_runtime_tables",
      "eligibilityState": "BASELINE_READY_WITH_ADOPTION",
      "informationalReasons": ["AUDITED_TABLE_OPTION_ADOPTION"]
    }
  ],
  "confirmation": {
    "only": ["20260712184500_create_auth_runtime_tables"]
  }
}
```

Não aparecem `STRUCTURAL_DRIFT`, `REQUIRED_ARTIFACT_MISSING`,
`ARTIFACT_MISMATCH`, `PHYSICAL_STATE_NOT_PRESENT` ou
`TABLE_OPTION_ADOPTION_DIFFERENCE_NOT_ACCEPTED`.

## Apply-one esperado

Antes do baseline fake:

```json
{
  "migrationId": "20260803133000_reconcile_auth_runtime_charset_collation",
  "eligible": false,
  "reasons": ["DEPENDENCY_NOT_APPLIED"]
}
```

Depois de simular a histórica como APPLIED no fake ledger:

```json
{
  "migrationId": "20260803133000_reconcile_auth_runtime_charset_collation",
  "physicalState": "TABLE_OPTION_DRIFT",
  "eligible": true,
  "reasons": []
}
```

`DEPENDENCY_STRUCTURAL_DRIFT` não aparece.

## Segurança

Toda a validação usa fixture, fakes e funções puras. Nenhuma conexão, baseline, migration, ledger,
schema ou dado real é acessado ou modificado.
