# Sprint 29.1E.1 — Persistência de responsável e progresso

## Decisão

Foi escolhida a Opção A: vínculos diretos e anuláveis no `Enrollment`:

- `responsible_person_id`;
- `responsible_profile_id`;
- `responsible_relationship_id`.

O convite digital atual possui um único responsável principal autorizado. Uma
tabela genérica de participantes aumentaria a complexidade sem requisito atual.
As PKs relacionadas são `VARCHAR(64)`, compatíveis com FKs reais.

## Progresso

`digital_enrollment_progress` mantém uma linha por Enrollment, sem PII. A linha
referencia o relacionamento autorizado e, opcionalmente, o último convite que a
alterou. Steps e status são allowlists no domínio. `revision` começa em 1 e
updates MySQL usam `WHERE enrollment_id = ? AND
responsible_relationship_id = ? AND revision = ?`.

`READY_FOR_REVIEW` exige todas as quatro etapas cadastrais e não altera o status
do Enrollment.

## DRAFTs antigos e backfill

As novas colunas do Enrollment são temporariamente anuláveis. Nenhum backfill
automático é realizado. DRAFTs sem `responsible_relationship_id` permanecem
bloqueados para escrita pública e exigem reconciliação administrativa assistida.
CPF, e-mail, nome, prioridade e ordem nunca são usados como heurística.

## Transação

O fluxo atual de `PreEnrollmentApplicationService` coordena services com runners
independentes e não possui rollback global. Por isso ele não foi alterado para
gravar o vínculo após criar o DRAFT: isso permitiria estado parcial.

Foi criada a fronteira `DigitalEnrollmentFormGateway`, que exige um
`transactionRunner` real para ownership/progresso. A integração da
pré-matrícula deve ocorrer em uma composition transacional dedicada, passando a
mesma conexão para People, Profiles, Relationships, Enrollment e Progress.

## Migration

`20260724150000_create_digital_enrollment_progress.js` é manual, idempotente na
topologia e compatível com MySQL 5.7/8.0. Ela falha fechada se dependências não
existirem, adiciona FKs/índices e cria a tabela de progresso. Não foi executada.

## Segurança e escopo

Não há token, hash, body ou PII no progresso. Nenhum endpoint foi montado,
nenhum frontend foi alterado e nenhum fluxo legado foi usado. Documentos,
contratos, consentimentos, financeiro, turma, agenda, ativação e `USED`
permanecem fora do escopo.

## Próxima etapa 29.1E.2

Implementar a composition transacional da pré-matrícula, mapear os três novos
campos no repository de Enrollment, criar o vínculo/progresso dentro da mesma
transação e então habilitar `getForm` interno para agregados inequívocos.
