# Sprint 27.17 — Conversão Segura de Lead para Pessoa, Aluno e Matrícula

## Status

**Bloqueada pelo gate arquitetural obrigatório.** Nenhum serviço, repository, migration ou fluxo de conversão foi implementado. A alternativa seria inventar dados obrigatórios, criar deduplicação dentro do CRM ou acessar diretamente tabelas de outros domínios, ações expressamente proibidas pela especificação.

## Estado anterior e auditoria

O worktree estava limpo na branch `sprint-23`, com HEAD `12df2e2 feat(crm): adiciona atividades comerciais do lead`. As Sprints 27.14, 27.15 e 27.16 estavam commitadas.

O Lead canônico possui `contactName`, `contactEmail`, `contactPhone`, `unitId`, origem, estágio, status e referências próprias do CRM. Ele não possui CPF/documento, data de nascimento, sexo nem dados canônicos separados de um aluno menor. `crm_leads` possui `person_id` e `converted_at`, mas não possui referências de perfil, aluno ou matrícula capazes de representar o resultado consolidado solicitado.

### Pessoas

`PersonApplicationService` expõe somente `createPerson()`. Ele não oferece operação pública para localizar Pessoa por CPF, e-mail ou telefone, detectar múltiplos candidatos ou resolver conflitos de identidade. O repository possui `findByCpf()` e filtros de listagem, mas utilizá-lo diretamente no CRM violaria a fronteira exigida `CRM -> serviço público do domínio proprietário` e ainda não forneceria uma política canônica completa de deduplicação.

### Perfis e Alunos

`ProfileApplicationService` expõe criação de perfil de responsável e aluno, mas não expõe localização ou `findOrCreate`. `StudentApplicationService.resolveStudentPerson()` somente reutiliza uma Pessoa quando recebe explicitamente `student.personId`; na ausência dele, exige `nome`, `dataNascimento` e `sexo`, cria uma Pessoa e depois cria um novo perfil de Aluno. O serviço não possui contrato para procurar uma Pessoa pela identidade do Lead, reutilizar perfil existente ou interromper múltiplos matches.

O Lead fornece nome, e-mail e telefone, mas não fornece `dataNascimento` nem `sexo`. Portanto, os dados mínimos reais para criar com segurança a Pessoa do aluno estão incompletos. Também não é possível inferir se o contato é o próprio aluno adulto ou um responsável por menor. Usar o contato como aluno inventaria semântica e poderia associar a matrícula à Pessoa errada.

### Matrículas

`EnrollmentApplicationService` possui o fluxo reutilizável `createDraftEnrollmentIdempotently()`, além de consultas de DRAFT e ACTIVE. O repository suporta persistência idempotente do rascunho, e a matrícula criada por esse fluxo permanece `DRAFT`. Entretanto, esse serviço exige `studentPersonId`, `studentProfileId` e `startDate`. Os dois primeiros não podem ser obtidos com segurança pelos contratos atuais a partir do Lead; `startDate` também não existe canonicamente no Lead.

O suporte transacional não é uniforme entre os serviços auditados. Repositories aceitam `queryRunner`, mas os serviços públicos de Pessoa/Perfil não expõem um unit of work compartilhado nem operações idempotentes de localização/criação. Não seria correto declarar atomicidade entre CRM, Pessoa, Perfil e Matrícula.

## Bloqueios comprovados

1. Não existe serviço público seguro para localizar e deduplicar Pessoa segundo uma regra canônica completa.
2. Não existe serviço público para localizar ou reutilizar perfil de Aluno.
3. Não existe serviço seguro para localizar ou reutilizar Aluno a partir da identidade disponível no Lead.
4. Faltam `dataNascimento`, `sexo` e `startDate`, exigidos pelos fluxos reais; esses dados não podem ser inventados.
5. Não é possível distinguir aluno adulto de responsável por aluno menor com os dados canônicos atuais.
6. Não existe transação compartilhada comprovada entre os serviços públicos envolvidos.
7. Uma implementação no CRM exigiria SQL direto em `people`/`person_profiles` ou duplicação de regras proprietárias.

Essas condições correspondem diretamente aos gates de interrupção da Sprint 27.17.

## Componentes que poderão ser reutilizados após desbloqueio

- `CrmLeadService` e `MySqlCrmLeadRepository` para leitura/autorização do Lead.
- `StudentApplicationService`, depois que houver resolução idempotente de identidade e perfil.
- `EnrollmentApplicationService.createDraftEnrollmentIdempotently()` para criar ou reutilizar uma matrícula `DRAFT` sem ativação.
- O padrão `queryRunner` dos repositories, caso os serviços proprietários exponham oficialmente um unit of work compartilhado.

## Decisão de persistência CRM

Nenhuma migration foi criada. Criar `crm_lead_conversions` agora registraria somente uma orquestração que não pode ser concluída com segurança. A decisão entre tabela própria e campos no Lead deve ocorrer depois que os contratos proprietários fornecerem IDs confiáveis e estratégia transacional/idempotente.

## Atomicidade, idempotência e retomada

- **Atomicidade comprovada:** inexistente entre os quatro domínios; não foi simulada.
- **Idempotência comprovada:** existe apenas no fluxo isolado de matrícula DRAFT, não no fluxo completo de conversão.
- **Retomada segura:** inexistente para Pessoa e Perfil porque os serviços atuais podem recriar registros sem uma consulta canônica anterior.
- **Concorrência:** não foi implementada; lock apenas no CRM não impediria duplicidade nos domínios proprietários.

## Matriz de resultados

| Cenário | Resultado seguro atual |
| --- | --- |
| Lead inexistente, aberto ou LOST | Validável pelo CRM, mas não foi criado orquestrador parcial |
| Lead WON sem dados do aluno | Bloqueado antes de persistência |
| Lead WON representando responsável | Bloqueado; aluno não pode ser inferido |
| Pessoa já existente | Bloqueado; falta resolvedor público canônico |
| Perfil já existente | Bloqueado; falta lookup público |
| Matrícula DRAFT | Fluxo proprietário existe, mas depende de IDs não resolvidos |
| Matrícula ACTIVE | Guard proprietário existe, mas depende dos mesmos IDs |

## Dados sensíveis

Nenhum dado pessoal foi persistido, registrado em logs ou incluído em testes. Este relatório menciona apenas nomes de campos e contratos, sem valores reais.

## Riscos residuais

Implementar sem corrigir os contratos proprietários pode gerar Pessoas duplicadas, perfis duplicados, matrícula vinculada ao responsável incorreto e estado parcial irrecuperável. Nenhuma compensação destrutiva foi criada.

## Próximos passos para desbloqueio

1. Criar no domínio Pessoas um resolvedor público canônico que normalize identificadores, detecte zero/um/múltiplos matches e retorne conflito sem PII.
2. Expor no domínio de Perfis uma operação idempotente de localização/criação por `personId + profileType` com restrição única correspondente.
3. Definir contrato explícito para aluno adulto versus responsável/aluno menor e fornecer os dados mínimos do aluno.
4. Definir a origem obrigatória de `startDate` da matrícula DRAFT.
5. Disponibilizar unit of work compartilhado ou um protocolo explícito e persistente de retomada por etapas.
6. Somente então definir a persistência mínima de `crm_lead_conversions`, com unicidade por Lead e concorrência transacional.

## Fora do escopo preservado

Nenhum frontend, controller, rota, financeiro, agenda, BI, notificação, automação, pipeline ou API pública foi alterado.
