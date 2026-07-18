# Sprint 27.17D — Conversão segura de Lead em matrícula DRAFT

## Resultado

A Sprint implementa o contrato `Lead elegível -> Pessoa/Aluno canônicos -> Enrollment DRAFT -> vínculo CRM completo`, sem reabrir validações físicas de MySQL e sem depender do índice `UNIQUE` de CPF normalizado.

## Operação pública

```js
convertLeadToDraftEnrollment(
  {
    leadId,
    studentData,
    enrollmentData: { startDate },
    idempotencyKey,
  },
  context,
);
```

O retorno contém somente `leadId`, `personId`, `personProfileId`, `enrollmentId`, estado `DRAFT`, resoluções e indicadores de reuso. CPF, e-mail, telefone, nome e demais PII não são gravados no vínculo CRM nem incluídos em erros técnicos.

Para uma conversão nova, `leadId`, `studentData` aceito pela A.9 e `enrollmentData.startDate` são obrigatórios; `idempotencyKey` é opcional. Uma conversão completa já registrada pode ser consultada novamente apenas com `leadId`.

## Elegibilidade e fluxo

A elegibilidade continua pertencendo à A.9: somente Lead da unidade autorizada com `stage=WON` e `status=CONVERTED` prossegue. Lead ausente, aberto, perdido ou sem autorização para a unidade para antes de Pessoa, Matrículas e persistência completa.

O fluxo executa consulta da conversão completa, A.9, fronteira pública de Matrículas e persistência CRM. Não é criada atividade adicional: o vínculo persistido já é a evidência operacional mínima e evita duplicar eventos comerciais nesta fase.

## Arquitetura

`CrmLeadEnrollmentConversionService` é um orquestrador de aplicação do domínio CRM. Suas dependências são injetadas por contrato:

1. `CrmLeadStudentConversionService.convertLeadToStudent()` — única fronteira usada para resolver/reutilizar Pessoa e perfil `aluno`;
2. `EnrollmentFacade.resolveOrCreateDraftEnrollmentForResolvedStudent()` — fronteira aditiva que recebe `personId` e `personProfileId` já resolvidos;
3. repositório de conversão completa do CRM — persiste apenas IDs operacionais.

O método anterior `resolveStudentAndCreateDraftEnrollment()` da Sprint A.8 permanece disponível e delega internamente à nova operação de Aluno resolvido. Nenhum import entre adaptadores concretos foi criado.

## Estados de Matrícula

- `NONE`: cria um único DRAFT pelo serviço moderno de Matrículas.
- `DRAFT`: reutiliza o registro existente sem alteração.
- `ACTIVE`: retorna `ENROLLMENT_ACTIVE_EXISTS`.
- `CONFLICT`: retorna `ENROLLMENT_STATE_CONFLICT` para revisão assistida.

Não são aceitos `status`, turma, financeiro, contrato ou outros efeitos no input da conversão.

## Idempotência, concorrência e retomada

Antes de chamar A.9 ou Matrículas, o serviço consulta a conversão completa por Lead e unidade. Se ela estiver completa e consistente, retorna os mesmos IDs com todas as resoluções como `FOUND`.

O repositório CRM abre uma transação local, bloqueia o Lead com `FOR UPDATE`, relê a conversão e grava sob restrições únicas de `lead_id` e `idempotency_key`. `ER_DUP_ENTRY` inicia uma releitura segura; resultados divergentes retornam `CRM_LEAD_ENROLLMENT_CONFLICT`.

Não existe transação distribuída entre CRM, Pessoas e Matrículas. A sequência é deliberadamente recuperável:

1. A.9 cria ou reutiliza Pessoa/perfil e registra a conversão parcial;
2. Matrículas cria ou reutiliza o DRAFT;
3. CRM registra a conversão completa.

Se a etapa 3 falhar, o retry reutiliza as etapas 1 e 2. Nenhuma Pessoa, perfil ou matrícula é excluída, revertida ou compensada.

## Persistência contratual

A migration `20260718220000_create_crm_lead_enrollment_conversions.js` define uma tabela complementar para distinguir conversões parciais A.9 de conversões que já possuem DRAFT. Ela possui FKs `RESTRICT`, índices operacionais, unicidade por Lead/chave e `down()` protegido contra remoção de tabela não vazia.

A migration foi adicionada apenas ao catálogo canônico e às dependências. Ela não foi executada em MySQL nesta Sprint.

## Segurança e privacidade

- autorização de unidade ocorre antes da primeira leitura ou efeito;
- o `context` original segue intacto para A.9 e Matrículas;
- o CRM não consulta Pessoa, perfil ou Enrollment diretamente;
- entradas arbitrárias de estado, turma e financeiro são rejeitadas;
- falhas desconhecidas de infraestrutura são convertidas em erro estável e sem PII;
- nenhuma atividade CRM adicional, log com CPF ou payload comercial foi criado.

## Limites

Esta Sprint não cria rota HTTP nem wiring de produção. O composition root futuro deverá injetar as instâncias oficiais de A.9, `EnrollmentFacade`, repositório CRM e autorização por unidade. Também não ativa matrícula, não cria financeiro, turma, contrato ou notificações.

As Sprints 27.17A.4.1C.1, 27.17A.4.1E e 27.17A.4.2 continuam encerradas por dependência externa. Nenhuma validação física, diagnóstico operacional ou índice `UNIQUE` de CPF foi executado ou retomado.

Nenhum consumidor foi migrado nesta Sprint, pois controller, rota, frontend, pré-matrícula e integrações estão fora do escopo. O consumidor imediato pendente é uma futura rota interna do CRM; os demais consumidores devem continuar usando suas fronteiras atuais até migração explícita.

## Riscos residuais

- a operação ainda não está disponível em runtime até existir wiring interno autorizado;
- a tabela contratual precisa ser aplicada futuramente pelo processo canônico em ambiente liberado antes do wiring;
- a consistência entre domínios é eventual e depende do retry documentado, pois não existe transação distribuída;
- o bloqueio físico de CPF continua condicionado às Sprints MySQL suspensas, sem alterar a resolução canônica atual.

## Próximos passos

- Sprint 27.17E — controller e rota interna de conversão do Lead;
- Sprint 27.17F — preview e confirmação da conversão no frontend;
- Sprint 27.17G — auditoria operacional e observabilidade da conversão.

Confirmação de matrícula e efeitos financeiros não devem ser iniciados automaticamente.
