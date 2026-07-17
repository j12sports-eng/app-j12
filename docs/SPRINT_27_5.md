# Sprint 27.5 — Preview Read-Only de Matrículas

## Objetivo e estado inicial

Integrar Matrículas ao Centro de Comando sem criar backend, endpoint, repository, contrato público ou operação de escrita. O preflight foi executado na branch `sprint-23`: typecheck, lint do Centro de Comando e builds client/SSR estavam aprovados. As mudanças locais da Sprint 27.4 foram preservadas como baseline.

## Auditoria e fonte real

O domínio canônico está em `backend/src/domains/enrollments`. Seus statuses são `ACTIVE`, `CANCELLED`, `DRAFT`, `FINISHED`, `PENDING` e `SUSPENDED`. Os endpoints administrativos de matrícula consultam registros por aluno/perfil e incluem uma operação de confirmação; por serem detalhados e potencialmente pessoais, não são usados pelo preview.

A fonte selecionada é `GET /admin/bi/students`, contrato `21.4` e `readOnly: true`. Embora o nome da rota seja Students, sua implementação agrega a tabela `enrollments` e fornece canonicamente `activeEnrollments`, `newEnrollments` e evolução de novas matrículas. O código real foi adotado como fonte de verdade.

## Arquitetura vertical

```text
EnrollmentCommandCenterPreview
→ useStudentsBI
→ studentsPreviewProvider
→ normalizeStudentsPreviewSource
→ adapter/provider compartilhados
→ getBiStudents
→ GET /admin/bi/students
```

O preview reutiliza `PreviewShell`, `PreviewField`, `PreviewReloadButton`, `PreviewStatePanel`, query options e registry. Não foi criado normalizador ou contrato paralelo.

## Contrato e interface

São projetadas apenas as métricas agregadas `activeEnrollments` e `newEnrollments`, além de `generatedAt` e `lastUpdate`. A evolução agregada é usada para distinguir resposta vazia. O normalizador existente rejeita números negativos ou não finitos, assegura arrays válidos e fornece fallback para datas inválidas.

A interface trata loading inicial, refreshing, empty, success, erro inicial com recarga e erro de refresh preservando os dados anteriores.

## Segurança

A rota BI usa `requireAuth` e `canManageSystem`; a rota frontend exige `admin` ou `coordenador`. O preview usa apenas GET, não cria nem altera matrícula, não confirma status, não gera obrigação financeira e não expõe nome, CPF, telefone, e-mail ou endereço. Não aceita tenant/unidade arbitrários na interface e não registra payloads no console.

## Performance

Há uma única consulta HTTP com query key estável e stale time de dois minutos. O backend executa consultas agregadas em paralelo, sem enviar listagem detalhada. Não há total calculado por página parcial, carregamento massivo ou agregação pesada durante render.

## Indicadores não implementados e limitações

Não existe na fonte escolhida total histórico global nem distribuição agregada por status. Portanto DRAFT, PENDING, SUSPENDED, CANCELLED, FINISHED e conflitos não são exibidos. A distribuição por turma também não faz parte desse contrato. Adicioná-los exige uma futura evolução backend read-only específica e autorizada.

## Testes e validação

Os testes cobrem os estados compartilhados, reload, preservação após erro de refresh, projeção somente agregada, ausência de PII e escrita, GET-only, registro determinístico e preservação dos previews Financeiro e Alunos. A validação inclui typecheck, lint, build client/SSR, testes do Centro de Comando e `git diff --check`.
