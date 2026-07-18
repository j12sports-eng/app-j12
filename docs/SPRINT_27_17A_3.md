# Sprint 27.17A.3 — Diagnóstico e Saneamento Controlado de Identidade

## Resultado

Foi criada uma ferramenta reutilizável e read-only para diagnosticar `people` em lotes, usando o normalizador canônico da Sprint 27.17A.2. A entrega classifica incompatibilidades e grupos, produz relatório seguro sem valores pessoais e audita perfis duplicados. Nenhum banco real foi consultado e nenhum dado/schema foi alterado.

## Baseline

- Branch: `sprint-23`.
- Commit base: `62f6d9a7d7348584da1e36de0aeac3fcef071919`.
- Worktree inicial: limpo; Sprint 27.17A.2 já incorporada.

## Arquitetura auditada

Foram revistos normalizador, mapper, validator, services/repositories de Pessoa e Perfil, migration de `people`, padrão `queryRunner`, scripts/CLIs, logger estruturado, política de PII, testes de migrations e documentação. A conexão configurada não foi usada porque não há confirmação explícita de ambiente local/homologação permitido.

`PersonRepository` não foi reutilizado: mistura leitura e escrita e pagina com `OFFSET`. O diagnóstico usa `PersonIdentityDiagnosticReadRepository`, que aceita `queryRunner` injetado, aplica guard `SELECT only`, projeta somente `id`, identificadores e `ativo`, e pagina por cursor `WHERE id > ? ORDER BY id LIMIT ?`.

## Componentes

- `person-identity-diagnostic.js`: regras, agregação, adapter read-only e orquestração com fechamento em `finally`.
- `person-identity-diagnostic.test.js`: fixtures integralmente sintéticos.
- `PESSOAS_IDENTITY_DIAGNOSTIC.sql`: inspeção manual agregada e somente leitura.
- `PERSON_IDENTITY_SANITIZATION_PLAN.md`: plano futuro sem executor.
- Export aditivo no boundary `backend/src/domains/pessoas/index.js`.

Não foi criado CLI que carregue automaticamente `db.js`: isso poderia conectar ao ambiente configurado sem confirmação e contrariaria o gate. A API aceita um `queryRunner` explicitamente fornecido e pode ser envolvida por CLI controlado em Sprint operacional futura.

## Contrato e categorias

Versão do diagnóstico: `1.0.0`. O contrato reutiliza diretamente `normalizeCpf`, `normalizeEmail` e `normalizePhone`.

Categorias implementadas:

- `DUPLICATE_STRONG_IDENTIFIER`: CPF normalizado em Pessoas distintas;
- `SHARED_CONTACT`: e-mail/telefone/celular normalizado compartilhado, sem inferir duplicidade;
- `FORMAT_VARIATION`: mesmo valor lógico em representações diferentes;
  `INVALID_IDENTIFIER`: valor incompatível com a sintaxe canônica;
  `LEGACY_INCOMPATIBILITY`: o mapper legado aceitaria/coagiria o mesmo valor rejeitado;
- `INCOMPLETE_IDENTITY`: ausência de CPF normalizável;
- `LEGACY_INCOMPATIBILITY`: mapper aceitaria/coagiria, mas o normalizador rejeita.

`CROSS_IDENTIFIER_CONFLICT` não é inferido: contato compartilhado junto a CPFs diferentes não prova conflito de Pessoa.

Severidades:

- `CRITICAL`: CPF normalizado duplicado;
- `HIGH`: incompatibilidade de CPF e múltiplos perfis ativos;
- `MEDIUM`: contato inválido, ausência de CPF, variação de formato e conflito de status de perfil;
- `LOW`: contato compartilhado.

## Métricas seguras

O relatório contém total processado, lotes, ausentes/normalizáveis/inválidos por tipo, grupos e Pessoas em CPF duplicado, contatos compartilhados, variações, registros aceitos só pelo mapper, risco de truncamento, valores incompatíveis, Pessoas sem identificador forte e grupos de perfis duplicados.

Detalhes contêm somente `issueType`, `personIds`, `field`, `count`, `severity` e ação recomendada. Não há nome, CPF, e-mail, telefone, endereço, nascimento, valor normalizado, original ou fingerprint.

## Escalabilidade e limites

- lote padrão 500; máximo 2.000;
- máximo padrão 10.000 Pessoas; teto explícito 100.000 por execução;
- detalhes padrão limitados a 100 grupos; teto 1.000;
- cursor por PK, sem `OFFSET` profundo;
- processamento sequencial, sem paralelismo agressivo;
- relatório incremental em métricas; mapas são limitados pelo teto de registros;
- execução reiniciável e determinística para o mesmo snapshot/clock;
- repository propaga falhas e `runPersonIdentityDiagnostic` fecha o recurso no `finally`.

Uma execução acima de 100.000 registros deve ser particionada/repensada antes de ampliar memória; o limite não pode ser desativado silenciosamente.

## Mapper atual

O mapper converte tipos com `String`, aplica `trim` e trunca. O diagnóstico contabiliza:

- aceitos por ambos;
- registros aceitos apenas pelo mapper;
- valores rejeitados pelo normalizador;
- registros com risco de truncamento pelo mapper.

O mapper não foi alterado. Futuramente, integração direta mudaria comportamento e precisa ocorrer apenas após backfill e tratamento das incompatibilidades.

## `findByCpf()`

A consulta atual usa igualdade bruta, `ORDER BY created_at DESC, id DESC LIMIT 1`. Com duplicados, oculta a ambiguidade e escolhe o registro mais recente. Não há consumidor público canônico auditado; `PersonService` apenas delega ao repository. Corrigir agora alteraria contrato. A futura resolução deve consultar a forma normalizada e retornar conflito quando houver múltiplos resultados, nunca selecionar o primeiro.

## Perfis

`person_profiles` não possui FK nem unique `(person_id, profile_type)`. A query agregada detecta mesmo tipo repetido, múltiplos ativos e estados divergentes, limitada a 100/1.000 grupos. Esses casos bloqueiam índice futuro até revisão assistida; nenhum perfil foi corrigido.

## SQL read-only

`docs/SQL/PESSOAS_IDENTITY_DIAGNOSTIC.sql` contém apenas `SHOW`, `SELECT` e `EXPLAIN`. Todas as saídas de qualidade são agregadas. As expressões SQL são aproximações e não substituem o normalizador JavaScript, especialmente para controles Unicode e semântica telefônica.

## Plano de saneamento

O plano separa candidatas futuras sem ambiguidade (máscara/trim/caixa), revisão assistida (CPF/perfis conflitantes e legado incompatível) e ações proibidas (merge, exclusão, escolha arbitrária, inferência de DDI/DDD e alteração de contato compartilhado). Nenhuma ação foi executada.

## Limitações e riscos

- não houve fotografia de dados reais, portanto não há números de produção;
- CPF continua sem validação de dígito verificador;
- dados modificados durante uma execução sem snapshot transacional podem produzir fotografia não atômica;
- collation/charset vivo devem ser confirmados;
- detalhes são truncados pelo limite de segurança, enquanto métricas continuam agregadas;
- IDs internos podem ser sensíveis operacionalmente e devem ter acesso restrito;
- o adapter não garante permissões read-only do usuário MySQL; o guard de SQL complementa, mas não substitui credencial de banco somente leitura.

## Critérios para Sprint 27.17A.4

Seguir os gates de `PERSON_IDENTITY_SANITIZATION_PLAN.md`: ambiente autorizado, schema vivo confirmado, diagnóstico completo, conflitos de CPF/perfil classificados, regra de escopo aprovada, backfill sem perda, rollout/rollback e preservação de contatos compartilháveis.

## Sugestão de commit

`feat(pessoas): adiciona diagnostico seguro de identidade`
