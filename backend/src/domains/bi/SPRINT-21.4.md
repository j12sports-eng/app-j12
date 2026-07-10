# Sprint 21.4 - BI de Alunos e Matrículas

Base: commit `4dae654` (Sprint 21.3). O objetivo é entregar analytics administrativos agregados e read-only em `GET /api/admin/bi/students`, protegidos por `requireAuth` e `canManageSystem`. A rota frontend é `/admin/bi/alunos`. Os filtros compartilhados são `period`, `startDate`, `endDate` e `unitId`, no timezone `America/Sao_Paulo`.

## Arquitetura e segurança

O controller conhece HTTP, o service resolve e reutiliza os períodos da foundation, o DTO estabiliza o contrato `21.4`, e o repository MySQL contém somente leituras agregadas. A DI ocorre na rota administrativa. Não existe endpoint público, escrita, N+1 ou carregamento de registros individuais. O payload não contém nome, documento, contato, endereço ou data de nascimento individual.

## Conceitos canônicos

- Pessoa: registro em `people`.
- Perfil Aluno: `person_profiles.profile_type = 'aluno'`, ligado à Pessoa por `person_id`.
- Aluno único: `COUNT(DISTINCT enrollments.student_person_id)`; nunca quantidade de perfis ou matrículas.
- Matrícula: `COUNT(DISTINCT enrollments.id)`; cada registro é ligado à Pessoa e ao perfil Aluno.
- Aluno ativo: Pessoa distinta com ao menos uma matrícula ativa.
- Matrícula ativa: `status = EnrollmentStatus.ACTIVE` e `deleted_at IS NULL`.
- Entrada: confirmação em `confirmed_at`. Novo aluno é a Pessoa cuja primeira confirmação conhecida, considerando todas as suas matrículas não excluídas, ocorre no período. Nova matrícula é cada matrícula distinta confirmada no período. Uma segunda matrícula no período não transforma uma Pessoa antiga em aluno novo.
- Unidade/modalidade: vínculos `ACTIVE` de `enrollment_class_links` com `j12_turmas`. `COUNT(DISTINCT student_person_id)` impede repetição dentro de cada categoria. Uma Pessoa vinculada a categorias distintas aparece em cada uma delas; por isso as categorias podem não somar o total global.
- Faixa etária: calculada exclusivamente por `people.data_nascimento`, referenciada ao fim do período. Data nula, futura ou idade fora de `0..120` é agregada como `nao_informado`; nenhuma data individual é retornada.

## Métricas indisponíveis

Cancelamento exige evento temporal canônico. Embora `end_date` exista no agregado, a transição persistida atual não grava esse campo e não há `cancelled_at` nem histórico de status confiável em `enrollments`. Por isso cancelamentos, saídas mensais, saldo líquido, retenção, churn e permanência média são retornados como indisponíveis (`available: false`, `value: null`), nunca zero ou série vazia apresentada como medição. Transferência também não possui modelo canônico; troca de turma não é inferida como transferência.

Alunos e matrículas ativos são snapshots atuais e não recebem comparação histórica. Novos alunos/matrículas usam a janela imediatamente anterior de igual duração; base anterior zero resulta em comparação indisponível. A evolução mensal mostra apenas entradas reais por `confirmed_at`.

## Estratégia SQL e limitações

O repository executa três consultas independentes em paralelo: KPIs, evolução e distribuições. Todas são parametrizadas e read-only, com paridade de placeholders verificada automaticamente. `DISTINCT` neutraliza múltiplas matrículas e múltiplos vínculos conforme a semântica de cada métrica; o filtro de unidade usa `EXISTS`, evitando multiplicar a consulta principal.

Não há snapshot histórico para reconstruir a base ativa em datas passadas. Portanto, ativos são o estado atual sujeito ao filtro de unidade, enquanto o período afeta entradas e a referência etária. Categorias simultâneas não são artificialmente exclusivas. A Sprint não cria migrations, exportações, previsões ou funcionalidades da 21.5.
