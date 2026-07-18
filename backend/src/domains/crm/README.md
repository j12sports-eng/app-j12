# CRM

O domínio CRM possui Lead, pipeline, histórico de estágio e atividades comerciais próprios. Seus dados de contato não constituem identidade canônica de Pessoa.

## Conversão para Aluno canônico

`CrmLeadStudentConversionService.convertLeadToStudent(input, context)` é o entrypoint moderno para vincular um Lead `WON` a Pessoa e perfil `aluno`.

O Lead atual representa um contato comercial ambíguo: não contém CPF, nascimento, sexo nem separação responsável/aluno. Por isso a conversão exige `studentData` explícito ou `personId` explícito e nunca copia automaticamente `contactName`, `contactEmail` ou `contactPhone` para o aluno.

O serviço chama apenas `StudentApplicationService.resolveOrCreateStudent()`. O CRM não acessa repositories de Pessoas, não usa `findByCpf()`, não cria `studentId` e não chama Matrículas.

A tabela `crm_lead_student_conversions` registra somente IDs operacionais, unidade, ator, data, estado e chave de idempotência. Ela não armazena PII. O repository bloqueia o Lead em transação e a restrição única por `lead_id` torna a conversão CRM idempotente.

Não existe transação compartilhada entre CRM e Pessoas. Se o registro CRM falhar após Pessoa/Perfil, a nova tentativa reutiliza a identidade canônica; nenhuma compensação destrutiva é executada.
