# Sprint 22.2 - Matriz de autorização

O backend é a fonte de autorização. Guards frontend servem apenas à navegação.

| Perfil | Recurso/ação | Escopo | Guard backend | Frontend/teste |
| --- | --- | --- | --- | --- |
| admin | administrar alunos, responsáveis, professores, turmas, agenda, financeiro, BI, quadras e campeonatos | global | `requireAuth` + `canManageSystem` | AppSidebar/rotas admin; testes de routers |
| coordenador | mesmas operações gerenciais atualmente aprovadas | global | `requireAuth` + `canManageSystem` | rotas admin; testes 403/permitido |
| professor | registrar/consultar presença | somente turmas atribuídas e alunos vinculados | `requireAuth` + ownership por `professor_id` | portal professor; teste negativo 22.2 |
| professor | listar cadastro/contrato de professores | negado | `requireAuth` + `canManageSystem` | sem acesso; teste 22.2 |
| aluno | perfil, agenda, presença, financeiro, contrato, notificações | `aluno_id/studentId` derivado do token | `requireAuth` + `resolveAlunoIdFromRequest` | `/portal-aluno`; testes existentes |
| responsável | perfil, agenda, presença, financeiro, contrato, notificações dos dependentes | vínculo persistido responsável-aluno | `requireAuth` + `assertResponsavel` + `resolveRequestedStudent` | seletor de dependentes; tentativa cruzada retorna 403 |
| público | matrícula pública e portal público de campeonatos | dados explicitamente sanitizados | validators/DTO público | rotas públicas e testes de sanitização |
| serviço n8n | automações financeiras | endpoints próprios | token de serviço + origin guard + rate limit | não aplicável; testes de middleware |
| webhook Inter | evento Pix | cobrança/evento correlacionado | assinatura/token + idempotência | não aplicável; testes mockados |

Diferenças admin/coordenador não são granulares no modelo atual: ambos passam em `canManageSystem`. Alterar essa política exige decisão de negócio, não foi inventado nesta sprint.
