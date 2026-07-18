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
