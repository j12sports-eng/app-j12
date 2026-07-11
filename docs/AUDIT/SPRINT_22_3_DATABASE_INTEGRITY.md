# Sprint 22.3 - Integridade do banco e persistencia

## Estado e escopo

Auditoria iniciada em 2026-07-11 na branch `sprint-22`, commit base `c2f6b6b`, working tree limpo. Foram lidos integralmente os quatro artefatos 22.1 e os quatro 22.2 em `docs/AUDIT`. Nenhuma migration, pagamento, Pix, chamada Banco Inter ou banco compartilhado foi executado.

## Conclusao executiva

A persistencia e funcional, mas nao esta pronta para producao. O bloqueio principal e epistemico e operacional: nao existe schema fisico conhecido/ledger de migrations, enquanto parte relevante do DDL roda no bootstrap ou dentro de repositories/services. A Sprint corrigiu o rollback destrutivo da migration duplicada de class links e adicionou contratos estruturais, sem alterar dados.

## Achados priorizados

- P0: aplicacao de migrations em HML/producao nao comprovada; schema fisico e restore tambem nao.
- P0: multiplas autoridades de schema (`config/db.js`, migrations, SQL avulso, repositories e services).
- P1: duplicidade de migration de `enrollment_class_links`; resolver somente apos comparar checksums/colunas do ambiente.
- P1: fontes financeiras paralelas e conciliacao Banco Inter/Pix nao homologada; proibido operar valores reais neste gate.
- P1: entrypoint PM2 apontado na 22.1 continua podendo esconder routers modernos; e bloqueador externo a esta Sprint, nao foi alterado.
- P2: LONGTEXT para JSON, status textuais e timestamps heterogeneos exigem validacao de dados antes de constraints.
- P2: queries BI/relatorios podem degradar por casts, agregacoes e OFFSET; indices novos dependem de EXPLAIN/cardinalidade.

## Financeiro

Colunas monetarias auditadas usam DECIMAL(10,2) ou DECIMAL(12,2); nao foi encontrado FLOAT/DOUBLE nas migrations financeiras. A aplicacao converte DECIMAL para Number e arredonda com `toFixed(2)`, adequado ao contrato atual mas nao equivalente a aritmetica decimal exata em cadeias longas. Obrigações usam unique por matricula/tipo; cobranças e eventos possuem chaves de idempotencia em partes do fluxo. Status possuem sinonimos e caixa variavel. Antes do go-live: reconciliar fontes, testar repeticao de webhook/txid/e2eid, concorrencia, arredondamento de fronteira e baixa parcial em HML sanitizada.

## Correcao e testes

`20260701120000_add_enrollment_class_links_table.js` agora conta registros e recusa `down` quando a tabela esta populada. O teste `database-migrations.contract.test.js` valida timestamps unicos, explicita a duplicidade sem oculta-la, exige guarda de rollback nas duas variantes, DECIMAL sem FLOAT/DOUBLE, unique de obrigacao e indices de historico. Trata-se de teste estrutural; nao prova execucao isolada/HML/producao.

## Gates e pendencias

Validacao local final: 10/10 testes focados aprovados; ESLint focado aprovado; Prettier dos cinco artefatos aprovado; `git diff --check` aprovado; build Client aprovado (3.737 modulos, 26,92 s); build SSR aprovado (449 modulos, 7,43 s), apenas com avisos de imports nao usados originados em dependencias TanStack.

Homologacao requer: clone sanitizado, dump de `information_schema`, dados orfaos/duplicados, versao MySQL, checksums das migrations, backup e restore testados, `up` repetido, rollback vazio, EXPLAIN e E2E financeiro mock/sandbox. Producao requer adicionalmente: evidencias de HML, janela/rollback aprovado, ledger, observabilidade, entrypoint correto, credenciais/certificados e conciliacao sandbox. O percentual real desta Sprint e **82%**: auditoria estatica, correcao segura, testes e documentacao concluidos; 18% depende de ambientes e autorizacoes externas.

## Limites

Nao foram adicionadas FKs ou indices sem evidencia de dados/cardinalidade. Nao se afirma que tabela ou migration existe em qualquer ambiente remoto. Sprint 22.4 nao foi iniciada.
