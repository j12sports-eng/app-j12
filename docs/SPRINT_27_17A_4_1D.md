# Sprint 27.17A.4.1D — Escopo de Identidade e Política de CPF

## Resultado

A Sprint formalizou o que é fato, regra documentada, inferência, proposta e pendência. Pessoa global com perfis e acesso contextuais foi aprovada como princípio arquitetural. Contatos compartilháveis, múltiplos perfis e separação entre identidade e autorização também foram aprovados.

Papel/obrigatoriedade do CPF, PJ, estrangeiros, alteração auditada, inativos e política de normalizado nulo permanecem `PROPOSED` ou `BLOCKED`. Não há base para inventar decisões civis, jurídicas, fiscais ou LGPD.

## Implementação declarativa

`person-identity-policy.js` contém oito decisões obrigatórias com estados fechados. O gate agora exige todas em `APPROVED`; qualquer `PROPOSED` ou `BLOCKED` produz blocker específico. O resultado global permanece `NOT_EXECUTED/BLOCKED`.

Não foram alterados repository, mapper, service, normalizador, migration, schema, API, controllers, rotas ou dados.

## Próximos passos

1. submeter as decisões bloqueadas à direção/jurídico da J12 Sports;
2. executar a validação MySQL isolada da A.4.1C.1;
3. realizar diagnóstico operacional autorizado na A.4.1E;
4. somente iniciar A.4.2 quando gates técnicos, operacionais e empresariais estiverem `APPROVED`.

O documento oficial completo está em `docs/PESSOAS/PERSON_IDENTITY_AND_CPF_POLICY.md`.
