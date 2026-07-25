# Sprint 29.1E.1C — Aplicação operacional da migration

## Situação

A migration alvo é
`backend/src/database/migrations/20260724150000_create_digital_enrollment_progress.js`.
Ela não foi executada nesta sprint porque não há um perfil secreto de
homologação inequivocamente identificado na sessão e a migration ainda não
consta em `migration-dependencies.js`.

Produção não pode ser usada como substituta para homologação.

## Dependências

A migration exige previamente:

- `20260712183000_create_people_domain_tables`;
- `20260629134546_create_enrollments_table`;
- `20260629190607_add_active_draft_unique_constraint_to_enrollments`;
- `20260719200000_add_pre_enrollment_integrity_constraints`;
- `20260720120000_create_enrollment_digital_invitations_table`.

Antes da execução, ela deve ser registrada no grafo canônico e o dry-run deve
listar somente a migration alvo como pendente. Se o runner listar outras
migrations, abortar e revisar cada uma.

## Ambiente permitido

O tooling existente aceita apenas HML isolada com:

- `HML_ISOLATED=true`;
- `HML_REAL_INTEGRATIONS_ENABLED=false`;
- `HML_INSTANCE_ID` iniciado por `hml-`;
- banco terminado em `_hml`, `_homolog` ou `_homologation`;
- host loopback para o perfil descartável documentado.

O arquivo de secrets deve ser fornecido fora do Git. Não registrar senha,
DATABASE_URL, tokens ou chaves. Qualquer host/banco que não seja
inequivocamente HML aborta a operação.

## Validação prévia

1. Validar o perfil:
   `node --env-file=<hml-secret-file> scripts/hml/j12-hml.cjs validate`.
2. Gerar plano:
   `node --env-file=<hml-secret-file> scripts/hml/j12-hml.cjs plan-migrations`.
3. Confirmar no plano a migration alvo e todas as dependências aplicadas.
4. Consultar somente leitura:
   `SELECT DATABASE()`, `SELECT VERSION()`, schemas, engines, collations,
   PKs/FKs e contagens.
5. Abortar diante de coluna/tabela parcial ou tipo divergente.

MySQL realiza commits implícitos em DDL. Não considerar a migration como uma
transação reversível.

## Backup obrigatório

Antes do `up`, criar dump consistente com timestamp, routines, triggers e
events. O comando deve receber credenciais pelo mecanismo seguro do ambiente,
sem senha na linha de comando ou log. Compactar em `.sql.gz` e validar:

- `gzip -t <backup>`;
- cabeçalho do dump;
- tamanho maior que zero;
- presença das tabelas críticas.

Se Backblaze estiver configurado e aprovado, enviar sem remover backups
anteriores e confirmar o objeto remoto. Sem backup válido, não executar.

## Aplicação em homologação

Usar exclusivamente o runner canônico com confirmação exata de host/banco. A
execução só é permitida quando o runner suportar aplicar isoladamente o plano
revisado. Não executar diretamente o arquivo JS nem SQL manual.

Registrar horário inicial/final e interromper diante de lock prolongado,
checksum divergente, migration em `APPLYING/FAILED` ou DDL parcial.

## Pós-migration

Validar:

- três colunas anuláveis em `enrollments`;
- índices e FKs para People/Profile/Relationship;
- tabela `digital_enrollment_progress`;
- unique por Enrollment;
- revision e índices;
- zero linhas de progresso;
- mesmas contagens de Enrollment e por status;
- nenhum DRAFT alterado ou ativado.

Depois executar health, login, consulta de Enrollment, pré-matrícula atual,
consulta pública de convite e confirmar ausência de rota pública de escrita.

## Rollback lógico

Não executar `down` automaticamente. Em falha de DDL ou corrupção:

1. parar somente HML;
2. preservar evidências;
3. restaurar o backup validado em ambiente controlado;
4. revalidar schema, contagens e aplicação;
5. remover estruturas somente se comprovadamente vazias e com aprovação.

## Produção futura

Produção exige autorização explícita posterior, backup local e externo, janela
de manutenção, revisão da versão MySQL, dry-run, validação de schema, smoke
tests, monitoramento de locks/erros e plano de restauração. Nenhum comando de
produção foi autorizado nesta sprint.

## Critérios atuais de desbloqueio

1. registrar a migration no grafo;
2. endurecer detecção de aplicação parcial de colunas/índices/FKs;
3. fornecer o caminho do perfil secreto de HML;
4. comprovar que host e banco são não produtivos;
5. criar e validar backup;
6. revisar o plano exato do runner.

A integração transacional da pré-matrícula continua desligada.
