# Sprint 27.17A.9 — Integração do CRM com Pessoa, Perfil e Aluno

## Resultado

Foi criado um fluxo aditivo que encerra em Pessoa e perfil de Aluno:

```text
CrmLeadStudentConversionService.convertLeadToStudent()
  -> carregar Lead no CRM
  -> autorizar usuário/unidade
  -> exigir WON/CONVERTED
  -> reutilizar conversão existente
  -> validar studentData explícito
  -> StudentApplicationService.resolveOrCreateStudent()
  -> registrar crm_lead_student_conversions
```

Nenhuma matrícula, API, rota, controller, frontend ou integração financeira foi criada.

## Modelo real do Lead

O cenário auditado é **C — ambíguo**. `crm_leads` possui `contact_name`, `contact_email`, `contact_phone`, `unit_id`, origem, estágio, status e `person_id` opcional. Não possui CPF, nascimento, sexo ou dados separados de responsável/aluno.

Consequentemente, contatos do Lead nunca são usados automaticamente para criar aluno. O chamador deve fornecer `studentData` explícito com `personId`, quando conhecido, ou `nome`, `dataNascimento` e `sexo`. CPF e contatos do aluno são opcionais e somente encaminhados ao boundary canônico. Campos arbitrários são rejeitados.

## Elegibilidade e autorização

- Lead inexistente: `CRM_LEAD_NOT_FOUND`.
- estágio diferente de `WON` ou status diferente de `CONVERTED`: `CRM_LEAD_NOT_CONVERTIBLE`.
- usuário ausente, unidade ausente ou sem permissão: `CRM_ACCESS_DENIED`.
- dados explícitos incompletos: `CRM_CONVERSION_DATA_INCOMPLETE`, contendo somente nomes de campos.
- conversão inconsistente: `CRM_LEAD_STUDENT_CONVERSION_CONFLICT`.

A autorização ocorre antes da leitura do Lead e é contextual à unidade. IDs globais resolvidos não concedem leitura adicional de dados de Pessoa.

## Pessoa e Perfil

A única operação externa ao CRM é `StudentApplicationService.resolveOrCreateStudent(studentData, context)`. Seus resultados `personId` e `personProfileId` são registrados; `studentId` não existe.

Erros canônicos de CPF, Pessoa, Perfil ou dados de Aluno são preservados. Pessoa e perfil encontrados não são atualizados, enriquecidos ou reconciliados pelo CRM.

## Persistência e migration

A migration `20260718200000_create_crm_lead_student_conversions.js` cria uma tabela específica porque `crm_leads.person_id` não representa o perfil e não registra uma conversão completa.

A tabela contém:

- `lead_id`, único;
- `unit_id`;
- `person_id` e `person_profile_id`;
- estado `COMPLETED`;
- ator e data;
- chave de idempotência;
- metadados operacionais opcionais.

Não contém nome, CPF, e-mail, telefone, nascimento, matrícula ou financeiro. FKs usam `RESTRICT`; o `down` recusa remover tabela não vazia. A migration foi adicionada ao catálogo com dependências explícitas das foundations de Pessoas e CRM, mas não foi executada em MySQL físico.

## Idempotência e concorrência

O serviço consulta a conversão antes de resolver o aluno. O repository executa em transação:

1. `SELECT` do Lead com `FOR UPDATE`;
2. nova consulta da conversão;
3. inserção;
4. releitura;
5. recuperação de `ER_DUP_ENTRY` por nova leitura.

A unicidade por `lead_id` garante um vínculo CRM por Lead. Uma conversão concorrente compatível é reutilizada; IDs divergentes resultam em conflito, sem escolha arbitrária.

## Transação e retomada

Não há unit of work compartilhada entre CRM e Pessoas. Pessoa/Perfil podem ser criados antes de falha ao registrar a conversão. A chamada seguinte resolve novamente de modo idempotente e registra o vínculo. Nenhuma Pessoa ou Perfil é excluída como compensação.

A proteção concorrente do vínculo CRM é física. As limitações concorrentes de Pessoa e Perfil permanecem as já documentadas nas Sprints A.6 e A.7; esta Sprint não promete unicidade física global de Pessoa.

## Atividade opcional

Não foi criada atividade `SYSTEM`. O vínculo persistido já fornece a evidência operacional necessária e evita que uma atividade secundária introduza acoplamento ou falha adicional.

## Consumidores

| Consumidor                                             | Estado   | Observação                        |
| ------------------------------------------------------ | -------- | --------------------------------- |
| `CrmLeadStudentConversionService.convertLeadToStudent` | MIGRATED | novo entrypoint moderno explícito |
| conversão para matrícula DRAFT                         | PENDING  | Sprint 27.17D                     |
| controllers, rotas e frontend                          | PENDING  | fora do escopo                    |
| pré-matrícula, portais e automações                    | PENDING  | fora do escopo                    |
| `j12_alunos`                                           | LEGACY   | não utilizado                     |

## Ausência de efeitos colaterais

O fluxo não importa nem chama `EnrollmentFacade`; não consulta/cria DRAFT, financeiro, contrato, turma, atividade, evento ou notificação.

## Riscos residuais

- ausência de atomicidade distribuída entre Pessoas e CRM;
- possível corrida na criação lógica de Pessoa/Perfil antes do lock CRM, conforme garantias atuais desses domínios;
- o futuro consumidor deve fornecer `studentData` semanticamente explícito e manter a autorização de unidade.

As Sprints 27.17A.4.1C.1, 27.17A.4.1E e 27.17A.4.2 não foram retomadas. O próximo passo é a Sprint 27.17D, que combinará este vínculo com o entrypoint de DRAFT da A.8 sem reimplementar nenhum domínio.
