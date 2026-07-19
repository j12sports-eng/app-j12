# CRM

O domínio CRM possui Lead, pipeline, histórico de estágio e atividades comerciais próprios. Seus dados de contato não constituem identidade canônica de Pessoa.

## Conversão para Aluno canônico

`CrmLeadStudentConversionService.convertLeadToStudent(input, context)` é o entrypoint moderno para vincular um Lead `WON` a Pessoa e perfil `aluno`.

O Lead atual representa um contato comercial ambíguo: não contém CPF, nascimento, sexo nem separação responsável/aluno. Por isso a conversão exige `studentData` explícito ou `personId` explícito e nunca copia automaticamente `contactName`, `contactEmail` ou `contactPhone` para o aluno.

O serviço chama apenas `StudentApplicationService.resolveOrCreateStudent()`. O CRM não acessa repositories de Pessoas, não usa `findByCpf()`, não cria `studentId` e não chama Matrículas.

A tabela `crm_lead_student_conversions` registra somente IDs operacionais, unidade, ator, data, estado e chave de idempotência. Ela não armazena PII. O repository bloqueia o Lead em transação e a restrição única por `lead_id` torna a conversão CRM idempotente.

Não existe transação compartilhada entre CRM e Pessoas. Se o registro CRM falhar após Pessoa/Perfil, a nova tentativa reutiliza a identidade canônica; nenhuma compensação destrutiva é executada.

## Conversão completa para matrícula DRAFT

`CrmLeadEnrollmentConversionService.convertLeadToDraftEnrollment(input, context)` compõe, nessa ordem, a conversão A.9 e a fronteira pública de Matrículas para Aluno já resolvido. O CRM não acessa repositórios ou serviços concretos de Pessoas e Matrículas.

A tabela complementar `crm_lead_enrollment_conversions` registra apenas os IDs de Lead, Pessoa, perfil e Enrollment, além de estado, unidade, ator, data e chave de idempotência. Um registro completo é consultado antes de qualquer efeito e pode ser retornado diretamente em retries.

Não há transação distribuída. Se a gravação CRM final falhar, a tentativa seguinte reutiliza a conversão de Aluno e o mesmo DRAFT. Estados `ACTIVE` e `CONFLICT` permanecem bloqueios determinísticos de Matrículas. A operação não cria turma, cobrança, contrato, frequência, notificação nem ativa matrícula.

## Conversão interna de Lead em matrícula DRAFT

A Sprint 27.17E expõe o fluxo de conversão da Sprint 27.17D por meio de uma rota interna autenticada e autorizada.

Endpoints:

- `POST /internal/crm/leads/:leadId/draft-enrollment`
- `POST /api/internal/crm/leads/:leadId/draft-enrollment`

A rota preserva `requireAuth → ensureCrmInternalAccess → controller`. `canManageSystem` representa a política global atual para administradores e coordenadores; não existe vínculo granular usuário–unidade na sessão.

O body aceita somente `studentData`, `enrollmentData` e `idempotencyKey`. `leadId` vem da URL, `userId` vem da autenticação e `unitId` é derivado de `crm_leads.unit_id` pelo `CrmLeadUnitContextService`. Input e contexto confiável permanecem separados.

A operação:

- rejeita campos extras e contexto controlado pelo cliente;
- converte somente Leads elegíveis;
- resolve ou reutiliza Pessoa e Perfil de Aluno;
- cria ou reutiliza matrícula em estado `DRAFT`;
- não ativa matrícula;
- não gera financeiro;
- não seleciona turma;
- não cria contrato ou notificações;
- não expõe CPF nem dados cadastrais na resposta.

As migrations contratuais das conversões CRM precisam estar aplicadas no ambiente antes da utilização operacional da rota. Os testes desta correção usam apenas fakes por injeção de dependência e não acessam MySQL externo.

## Consulta interna de Leads

A Sprint 27.17E.2 adiciona leitura autenticada e somente leitura no router interno:

- GET /internal/crm/leads e GET /api/internal/crm/leads;
- GET /internal/crm/leads/:leadId e GET /api/internal/crm/leads/:leadId.

As rotas preservam requireAuth → ensureCrmInternalAccess → CrmLeadQueryController. A autorização permanece global para administradores/coordenadores; unitId é apenas filtro administrativo, sem vínculo granular usuário–unidade.

O body não é usado. A listagem aceita somente cursor, limit, stage, status, conversionStatus e unitId; o limite padrão é 50, o máximo é 100 e a paginação é cursor-based por created_at + id. O cursor é opaco, versionado e limitado a 256 caracteres.

CrmLeadQueryService calcula a elegibilidade com a mesma regra da conversão (WON + CONVERTED) e consolida os estados de crm_lead_student_conversions e crm_lead_enrollment_conversions. A listagem não retorna contato comercial; o detalhe retorna somente nome, e-mail e telefone do contato, nunca CPF, metadata, payload ou idempotency key.

O repository usa uma única consulta parametrizada com LEFT JOIN, ordenação determinística e sem N+1. Não há totalCount, OFFSET, busca textual, cache, escrita, migration, schema, frontend ou execução de MySQL externo. O contrato está documentado em docs/SPRINT_27_17E_2.md e preparado para a Sprint 27.17F.

## Observabilidade da conversão — Sprint 27.17G

A conversão interna é envolvida por `CrmLeadEnrollmentConversionObservabilityDecorator` na composition root. O decorator registra `CRM_LEAD_ENROLLMENT_CONVERSION_STARTED`, `CRM_LEAD_ENROLLMENT_CONVERSION_SUCCEEDED` e `CRM_LEAD_ENROLLMENT_CONVERSION_FAILED` pelo logger estruturado existente, preservando `correlationId`, duração monotônica, IDs operacionais, resoluções, flags de reuso, resultado `DRAFT` e códigos de erro sanitizados.

A auditoria aceita somente allowlist de campos, limita strings, usa fingerprint SHA-256 para idempotência e nunca registra PII, body, token, SQL, stack ou mensagens originais. `CrmLeadEnrollmentConversionMetrics` mantém contadores/observações process-local bounded com labels `source`, `result`, `errorCode` e `enrollmentResolution`; IDs não são labels. Falha de auditoria é fail-open e não bloqueia nem altera a conversão principal.

Não foi criada migration, tabela de auditoria, endpoint histórico ou execução MySQL. A Sprint 27.17H poderá substituir o adapter de logs por persistência histórica sem alterar o contrato funcional.

## Histórico visual de conversões — Sprint 27.17H

A fonte canônica do histórico read-only é crm_lead_enrollment_conversions. Ela permite listar e detalhar conversões COMPLETED com IDs de Lead, unidade, Pessoa, perfil e matrícula, além de convertedBy, convertedAt e enrollmentStatus. A projeção não consulta Pessoas ou Matrículas, não faz JOIN/N+1 e não seleciona idempotency_key ou metadata_json.

Endpoints protegidos:

- GET /internal/crm/conversions e alias /api/internal/crm/conversions;
- GET /internal/crm/conversions/:conversionId e alias /api/internal/crm/conversions/:conversionId.

Filtros aceitos: cursor, limit, leadId, unitId, convertedBy, enrollmentStatus, dateFrom e dateTo. O limite padrão é 50 e o máximo é 100. A paginação usa cursor opaco por converted_at + id, ordenação decrescente determinística, sem OFFSET ou totalCount.

correlationId, resoluções, flags de reuso e versão não estão persistidos na tabela e são retornados como null; não são inferidos de logs ou métricas. O histórico não apresenta tentativas ou falhas: esses eventos permanecem somente nos logs operacionais externos, que não possuem API consultável nem retenção comprovada no repositório.

O frontend protegido está em /admin/crm/conversions, com filtros reais, tabela no desktop, cards em telas menores e diálogo de detalhe. Após uma conversão bem-sucedida, React Query invalida o histórico e as queries de lista/detalhe do Lead.

Nenhuma migration, schema, escrita, conexão MySQL externa ou histórico fictício foi adicionada. O SELECT não contém PII, contato, idempotência, metadata, SQL ou stack. O contrato completo está em docs/SPRINT_27_17H.md.

- Sprint 27.17I: `GET /internal/crm/conversions/export` (alias `/api/internal/crm/conversions/export`) exporta CSV UTF-8 com BOM do histórico concluído persistido. Aceita somente `leadId`, `unitId`, `convertedBy`, `enrollmentStatus`, `dateFrom` e `dateTo`, com limite de 5.000 registros, sem PII/payload/metadata/idempotência. Reutiliza autenticação, autorização e rate limiter globais; XLSX permanece fora do escopo.

## Pipeline comercial read-only — Sprint 27.18

O contrato canônico reutiliza `NEW → CONTACTED → QUALIFIED → PROPOSAL → NEGOTIATION → WON`, com saída terminal `LOST` nos estágios abertos. A política única permanece em `lead-stage-transition-policy.js`; `CrmPipelineService` apenas valida/simula transições e não recebe repository.

`GET /internal/crm/pipeline` e o alias `/api/internal/crm/pipeline` retornam estágios, ordem, cores, descrições, transições e configuração allowlistada dos cards sob `requireAuth → ensureCrmInternalAccess`. A tela `/admin/crm/leads` apresenta o Kanban sem drag-and-drop ou escrita. Cards mostram somente Lead ID, origem, responsável, status e última atualização. As contagens são dos Leads carregados pela paginação existente; nenhum total global é inferido.

Não houve migration, schema ou execução MySQL externa. Estágios legados de aula experimental continuam visíveis de forma read-only quando presentes, sem serem promovidos à política comercial canônica. Conversão, preview, observabilidade, histórico e exportação permanecem compatíveis.

# Sprint 27.18A

Internal stage transitions reuse the canonical pipeline, trusted unit context, transactional history and compare-and-swap persistence. The allowlisted body accepts nextStage, reason, expectedStage and expectedStatus; LOST requires a sanitized reason.

## Sprint 27.18B — Drag-and-drop seguro

O Kanban administrativo reutiliza `@dnd-kit/core` e aceita somente destinos publicados em `stage.transitions` pelo endpoint do pipeline. O card permanece na coluna original até a confirmação do PATCH canônico; falhas preservam a posição e conflitos invalidam leads, pipeline, detalhe e histórico para recarregar o estado do backend.

LOST reutiliza o diálogo de alteração e exige motivo; WON exige confirmação e nunca converte automaticamente em matrícula. O botão manual e a operação por teclado permanecem disponíveis. A telemetria frontend registra apenas os cinco eventos de drag, estágios, duração, `leadId` e `correlationId`, sem PII. Consulte `docs/SPRINT_27_18B.md`.

## Sprint 27.18B.1 — Validação E2E desktop e touch

A validação isolada usa Playwright com frontend Vite local e contratos HTTP sintéticos, sem iniciar backend ou acessar MySQL. Execute `npm run e2e:27.18b.1`; screenshots, traces de falha e o relatório JSON ficam em `artifacts/e2e/crm-kanban/`, diretório excluído do Git.

Os testes comprovaram e corrigiram pontos mínimos: o `DragOverlay` agora é portado para `document.body`, evitando deslocamento por ancestrais transformados, e conflitos `CRM_STAGE_CONFLICT` invalidam as queries na mutação de estágio correta. O handle bloqueia pan e seleção apenas durante o gesto touch por meio de `touch-action: none` e `user-select: none`; a modal controlada também devolve o foco ao botão do Lead após fechar. Consulte `docs/SPRINT_27_18B_1.md`.

## Sprint 27.18C — SLA e tempo por etapa

O tempo do funil é derivado exclusivamente de `crm_lead_stage_history`. Leads cujo primeiro evento ordenado é um `CREATED` confiável têm cobertura `COMPLETE`; históricos úteis sem início comprovado são `PARTIAL`; ausência de evidência para a etapa atual é `UNAVAILABLE`. `crm_leads.created_at` nunca é usado para inventar uma entrada.

`CrmLeadStageTimingQueryService` usa `clock.now()` injetável, normaliza os instantes para UTC, limita o detalhe a 500 eventos e aplica `CrmLeadStageSlaPolicy`. Como não existe prazo empresarial aprovado, os limites operacionais estão vazios e Leads ativos mensuráveis retornam `NOT_CONFIGURED`; WON/LOST retornam `COMPLETED`.

Endpoints read-only protegidos:

- `GET /internal/crm/leads/:leadId/stage-timing`;
- `GET /api/internal/crm/leads/:leadId/stage-timing`.

A resposta não seleciona contato ou `reason`. A listagem paginada existente inclui um resumo de timing em uma única consulta limitada para alimentar os cards, sem N+1. O endpoint/filtro global de SLA não foi criado porque não há metas aprovadas e uma visão baseada apenas na página carregada seria enganosa.

O Kanban exibe duração, badge textual e cobertura; o detalhe exibe resumo e timeline. A apresentação avança a cada 60 segundos e pausa em aba oculta, sem polling por segundo. Não houve migration, escrita periódica, job, notificação, automação ou MySQL externo. Contrato completo em `docs/SPRINT_27_18C.md`.
