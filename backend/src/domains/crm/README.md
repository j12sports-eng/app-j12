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
