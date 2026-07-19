# Runbook — Migrations de Integridade da Pré-Matrícula

## 1. Escopo

Este runbook cobre exclusivamente:

1. `20260717220000_add_people_normalized_identity_columns.js`;
2. `20260719200000_add_pre_enrollment_integrity_constraints.js`.

Ele não autoriza unicidade física de CPF, saneamento automático, merge de Pessoas ou aplicação automática. A ordem obrigatória é identidade normalizada antes de integridade de perfis/relacionamentos.

## 2. Responsáveis e evidências

Antes da janela, registrar:

- ambiente, hostname lógico e nome exato do banco, sem credenciais;
- change ticket e aprovadores;
- SHA da aplicação e checksums do catálogo de migrations;
- operador, revisor, DBA e responsável pelo rollback;
- início/fim da janela e critério de abort;
- caminho seguro do backup e checksum, sem inserir secrets no ticket;
- saída sanitizada de cada comando deste runbook.

## 3. Gates obrigatórios

Interromper antes de qualquer `up` se ocorrer qualquer item:

- duplicidade de CPF normalizado, perfil ou relacionamento ativo;
- schema divergente ou índice incompatível;
- versão do banco sem suporte às generated columns usadas;
- backup ausente, não validado ou sem restore testado;
- migration anterior pendente, ledger divergente ou checksum incompatível;
- linha `APPLYING`, `FAILED` ou órfã no ledger;
- plano contendo migrations não incluídas na mudança aprovada;
- status com falha ou ambiente/banco incorreto;
- writers legados concorrentes não controlados;
- ausência de rollback ensaiado em clone/homologação;
- janela insuficiente ou monitoramento indisponível.

## 4. Preflight sem banco

Executar no mesmo SHA que será implantado:

```text
node backend/src/database/migration-runner/cli.js plan
node backend/src/database/migration-runner/cli.js up --dry-run
```

Os dois comandos não criam pool de banco. Revisar ordem, dependências e checksums. O plano canônico deve colocar a migration de identidade antes da migration de integridade.

Se o plano incluir outras migrations pendentes, interromper. O runner atual não oferece seleção de migration; executar `up` aplicaria todo o plano pendente.

## 5. Preflight read-only por ambiente

Carregar a configuração oficial do ambiente sem imprimir credenciais e executar:

```text
node backend/src/database/audits/pre-enrollment-integrity.audit.js
node backend/src/database/migrations/20260717220000_add_people_normalized_identity_columns.js status
node backend/src/database/migrations/20260719200000_add_pre_enrollment_integrity_constraints.js status
node --env-file=.env backend/src/database/migration-runner/cli.js status --confirm-database=<NOME_EXATO>
```

Para host remoto, o runner exige adicionalmente `--allow-remote`. Essa flag é apenas uma trava técnica e nunca substitui aprovação, backup ou conferência do ambiente.

Evidências esperadas antes do primeiro rollout:

- `readOnly: true`;
- zero grupos duplicados;
- `enrollmentDraftConstraintHealthy: true`;
- schema das tabelas requerido presente;
- status atual das duas migrations conhecido;
- ledger sem blockers;
- nenhum valor pessoal em claro no relatório.

Executar novamente imediatamente antes da janela. Resultado antigo não autoriza rollout.

## 6. Backup e restore

1. Suspender ou controlar writers conforme o plano da janela.
2. Gerar backup consistente conforme `docs/DEPLOY/BACKUP.md`.
3. Registrar tamanho, horário, checksum e retenção.
4. Restaurar o backup em ambiente descartável.
5. Validar tabelas `people`, `person_profiles`, `person_relationships`, `enrollments` e `j12_schema_migrations`.
6. Executar nesse clone os testes de `status`, `up`, pós-validação e recuperação.

Sem restore validado, interromper.

## 7. Homologação

Na homologação:

1. implantar o SHA aprovado;
2. repetir preflight e status;
3. bloquear o rollout se houver drift;
4. executar o runner canônico somente quando o plano pendente corresponder exatamente à mudança aprovada:

```text
node --env-file=.env backend/src/database/migration-runner/cli.js up --confirm-database=<NOME_EXATO>
```

Adicionar `--allow-remote` apenas quando o host for remoto e a mudança estiver formalmente autorizada.

Depois do `up`, executar novamente:

```text
node backend/src/database/audits/pre-enrollment-integrity.audit.js
node backend/src/database/migrations/20260717220000_add_people_normalized_identity_columns.js status
node backend/src/database/migrations/20260719200000_add_pre_enrollment_integrity_constraints.js status
node --env-file=.env backend/src/database/migration-runner/cli.js status --confirm-database=<NOME_EXATO>
```

Critérios de aceite:

- ledger `APPLIED` com checksum correto;
- colunas/índices normalizados compatíveis;
- backfill sem pendências não classificadas;
- `ux_person_profiles_person_type` presente;
- generated columns e `ux_person_relationships_active_structure` presentes;
- zero duplicidades;
- DRAFT único preservado;
- suítes Pessoas, Enrollment e CRM verdes;
- nenhuma elevação sustentada de 4xx/5xx, lock wait ou latência.

## 8. Produção

Produção exige aprovação após homologação e janela dedicada:

1. confirmar SHA e plano imutáveis;
2. confirmar backup/restore e owners;
3. reduzir ou pausar writers de Pessoas durante o backfill;
4. repetir auditoria e status imediatamente antes do comando;
5. comparar nome do banco e ambiente em voz dupla;
6. executar o mesmo runner canônico;
7. preservar toda saída sanitizada;
8. executar validação pós-migration antes de liberar writers;
9. observar métricas e logs durante a janela acordada.

Não executar os arquivos de migration individualmente em produção para contornar ledger, ordem ou blockers.

## 9. Critérios de interrupção durante a execução

Interromper novas ações e preservar evidências quando houver:

- erro do runner ou estado `FAILED`;
- DDL parcialmente aplicado;
- timeout/lock excessivo;
- contagem inesperada de registros;
- índice incompatível;
- aumento de erro ou latência;
- perda de conectividade;
- qualquer diferença entre plano aprovado e execução.

Não repetir `up` cegamente. MySQL pode realizar commit implícito em DDL.

## 10. Rollback e recuperação

Rollback de aplicação não reverte schema.

- Migration de identidade: o `down` automático bloqueia quando as colunas normalizadas possuem dados. Priorizar forward-fix ou restore aprovado.
- Migration de integridade: o `down` remove somente índices e generated columns, sem apagar dados de negócio, mas exige autorização e validação de compatibilidade.
- Estado `FAILED`: inspecionar schema, ledger, checksum e último DDL antes de decidir.
- Corrupção/perda de dados: seguir `docs/DEPLOY/ROLLBACK_RUNBOOK.md`; restore produtivo exige DBA e aprovação formal.

Nunca excluir ou mesclar Pessoas, perfis ou vínculos automaticamente para fazer a migration passar.

## 11. Monitoramento pós-deploy

Monitorar:

- 4xx/5xx e latência dos fluxos de Pessoas, CRM e Enrollment;
- `ER_DUP_ENTRY` recuperados pelos services;
- lock waits, pool e conexões;
- criação/reutilização de perfis, vínculos e DRAFT;
- ledger e checksums;
- erros sanitizados sem CPF, telefone, e-mail, token ou payload completo.

Reexecutar auditoria read-only ao final da janela e anexar o relatório sanitizado à mudança.

## 12. Fora deste runbook

- índice único de CPF;
- criação de membership usuário–unidade;
- montagem da rota interna de pré-matrícula;
- saneamento, merge ou exclusão automática;
- convite, cobrança, contrato ou ativação de matrícula.
