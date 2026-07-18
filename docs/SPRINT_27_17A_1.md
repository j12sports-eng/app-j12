# Sprint 27.17A.1 — Auditoria Estrutural de Identidade no Domínio de Pessoas

## Resultado executivo

Auditoria exclusivamente documental. Nenhum código, schema, migration, configuração ou comportamento foi alterado.

O modelo moderno usa `people` como Pessoa global e `person_profiles` como papéis, mas não possui identificador de negócio normalizado nem restrição física que impeça Pessoas ou perfis duplicados. CPF, e-mail e telefone são opcionais, recebem apenas `trim`/limite de tamanho e possuem, no máximo, índices comuns. O único identificador inequivocamente único em `people` é o `id` técnico.

O ERP ainda mantém fluxos legados independentes em `j12_alunos`, `j12_alunos_responsaveis` e `j12_responsaveis`. Esses fluxos não passam pelo serviço moderno de Pessoa. Assim, “Pessoa” não é hoje uma fonte única para todos os indivíduos do ERP.

Detalhes, matriz de evidências e proposta: [Auditoria do modelo de identidade](./PESSOAS/PERSON_IDENTITY_MODEL_AUDIT.md).

Consultas manuais, somente leitura e sem PII integral: [PESSOAS_IDENTITY_AUDIT.sql](./SQL/PESSOAS_IDENTITY_AUDIT.sql).

## Baseline

- Branch: `sprint-23`.
- Commit base: `9bc094b1fcca79ec9ea8738f94c238c95ebea185`.
- Worktree inicial: limpo (`git status --short` sem saída).
- Fonte do schema confirmado: migration versionada `20260712183000_create_people_domain_tables.sql`, SQL do domínio e DDL espelhado no repository.
- Banco vivo: não utilizado; nenhuma conclusão de qualidade de dados ou schema efetivamente aplicado foi presumida.

## Decisão da Sprint

A Sprint 27.17A permanece bloqueada para implementação. Resolver por `SELECT` seguido de `INSERT` não é idempotente entre processos PM2. Antes de um resolvedor público, são necessários normalização canônica versionada, diagnóstico dos dados existentes, definição oficial do escopo de CPF e garantia física compatível com nulos e legado.

## Sequência recomendada

1. Sprint 27.17A.2 — contrato canônico puro de normalização e validação, ainda sem alterar persistência.
2. Sprint 27.17A.3 — diagnóstico de duplicidades, classificação assistida e plano reversível de saneamento.
3. Sprint 27.17A.4 — migrations aditivas para identificadores/contatos, backfill e garantias físicas após gate de dados.
4. Sprint 27.17A.5 — serviço público de resolução e perfil idempotente, com tratamento de conflito e concorrência.
5. Retomar Sprint 27.17 — conversão do CRM consumindo somente o contrato público do domínio Pessoas.

## Sugestão de commit

`docs(pessoas): audita modelo de identidade`
