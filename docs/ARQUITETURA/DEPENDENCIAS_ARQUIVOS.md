# Dependencias por Arquivo

Inventario de impacto por arquivo da Sprint 4. Para arquivos de baixo impacto com padrao identico, as dependencias sao registradas por familia para evitar duplicacao sem perder rastreabilidade.

## Indice

- [Metodologia](#metodologia)
- [Legenda](#legenda)
- [Arquivos Criticos e Alto Impacto](#arquivos-criticos-e-alto-impacto)
- [Backend - Arquivos por Familia](#backend---arquivos-por-familia)
- [Frontend - Arquivos por Familia](#frontend---arquivos-por-familia)
- [UI Primitives](#ui-primitives)
- [Arquivos Gerados, Legados e Auxiliares](#arquivos-gerados-legados-e-auxiliares)
- [Observacoes](#observacoes)
- [Links Relacionados](#links-relacionados)

## Metodologia

Campos usados:

- Quem importa: consumidores diretos ou familia consumidora.
- Importa: arquivos internos principais importados.
- Modulos dependentes: dominios que quebram se o arquivo mudar.
- APIs: endpoints consumidos pelo arquivo.
- Tabelas: tabelas acessadas diretamente pelo backend.
- Dependentes React/hooks/services/controllers: consumidores por tipo quando aplicavel.
- Impacto: baixo, medio, alto ou critico.

## Legenda

| Abreviacao | Significado |
| --- | --- |
| N/A | Nao se aplica. |
| UI | Componente visual sem chamada de API direta. |
| Store | Store ou lib de estado frontend. |
| Hook | Hook React que consome API/estado. |
| Route | Rota React ou Express. |
| Service | Service frontend/backend. |
| Controller | Controller backend. |

## Arquivos Criticos e Alto Impacto

| Arquivo | Quem importa | Importa | Modulos dependentes | APIs | Tabelas | Dependentes por tipo | Impacto |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `src/lib/api.ts` | Hooks, stores, services, auth, componentes financeiros e contratos | `auth-storage`, `ssr-debug` | Todos os modulos frontend com API | Todas via `api.*`/`apiFetch` | N/A | Hooks, stores, services, components | Critico |
| `src/lib/auth-store.tsx` | `src/lib/auth.tsx`, layouts, rotas protegidas, menus | `api`, `auth-storage`, `ssr-debug` | Login, Usuarios, Portais, RBAC | `/auth/*` | N/A | Components, routes, hooks | Critico |
| `src/lib/auth.tsx` | Rotas, AppShell, Portal layouts, ProtectedRoute | `auth-store` | Todos os modulos protegidos | Indiretas por auth-store | N/A | Components/routes | Critico |
| `src/lib/auth-storage.ts` | `api`, `auth-store` | storage browser | Login, API client | N/A | N/A | Auth/API | Critico |
| `src/routes/__root.tsx` | TanStack Router | AuthProvider, QueryClientProvider, ThemeProvider, ResponsavelStudentsProvider | App inteiro | Indiretas | N/A | Todas as rotas | Critico |
| `src/router.tsx` | Entrada TanStack | route tree | App inteiro | N/A | N/A | App/router | Alto |
| `src/routeTree.gen.ts` | Router | Todas as rotas | App inteiro | N/A | N/A | Gerado; nao editar manualmente | Alto |
| `src/lib/alunos-store.ts` | Dashboard, Alunos, Turmas, Contratos, FormDialog, PerfilDialog | `api`, stores de catalogo dinamicas | Cadastros, Dashboard, Agenda, Financeiro, Contratos | `/alunos`, `/alunos/:id` | N/A | Components/hooks/routes | Critico |
| `src/lib/alunos-api.ts` | Fluxos auxiliares de alunos | `api`, auth storage | Cadastros | `/alunos` | N/A | Store/servicos de aluno | Alto |
| `src/routes/alunos.tsx` | Router | Aluno dialogs, contratos, alunos-store, auth, turmas, settings | Cadastros | Indiretas por stores | N/A | Componentes de cadastro | Alto |
| `src/components/alunos/AlunoFormDialog.tsx` | `src/routes/alunos.tsx` | alunos-store, modalidades, turmas, planos, responsaveis, settings | Cadastros | Indiretas por stores | N/A | Rota Alunos | Alto |
| `src/components/alunos/AlunoPerfilDialog.tsx` | Alunos/Turmas | alunos-store, contratos-store, financeiro-store, turmas-store | Cadastros, Contratos, Financeiro, Agenda | Indiretas | N/A | Rota Alunos/Turmas | Alto |
| `src/hooks/useFinanceiroAdmin.ts` | Dashboard, Admin Financeiro | `api`, `socket` | Financeiro, Dashboard, Relatorios | `/financeiro/*`, `/pix/create` | N/A | Rotas financeiras/dashboard | Critico |
| `src/routes/admin/financeiro.tsx` | Router | useFinanceiroAdmin, movement modal | Financeiro | Indiretas | N/A | Componentes financeiros | Alto |
| `src/components/financeiro/create-charge/CreateChargeModal.tsx` | Financeiro | `api`, steps, schema | Financeiro, Alunos, Planos | `/alunos`, `/planos` | N/A | Financeiro | Alto |
| `src/components/financeiro/movement-modal/FinancialMovementModal.tsx` | Admin Financeiro | `api`, zod schema | Financeiro | `/alunos`, `/planos` | N/A | Financeiro | Alto |
| `src/routes/dashboard.tsx` | Router | alunos-store, turmas-store, professores-store, trial-classes, useFinanceiroAdmin, Birthdays | Dashboard, Agenda, Financeiro | Indiretas | N/A | Dashboard widgets | Alto |
| `src/components/dashboard/BirthdaysDashboardCard.tsx` | Dashboard | BirthdayHook, carousel/tabs/card | Dashboard | `/dashboard/birthdays` indireta | N/A | Dashboard | Medio/Alto |
| `src/hooks/BirthdayHook.ts` | BirthdaysDashboardCard | BirthdayService, api error formatter | Dashboard | `/dashboard/birthdays` | N/A | Dashboard components | Medio |
| `src/services/BirthdayService.ts` | BirthdayHook | `api`, BirthdayTypes | Dashboard | `/dashboard/birthdays` | N/A | Hook | Medio |
| `src/lib/turmas-store.ts` | Dashboard, Turmas, Alunos, Agenda, Formularios | `api`, mysql store | Agenda, Turmas, Alunos | `/turmas` | N/A | Routes/components | Alto |
| `src/lib/professores-store.ts` | Dashboard, Professores, Aula experimental, Turmas | `api`, mysql store | Professores, Agenda | `/professores` | N/A | Routes/components | Alto |
| `src/lib/financeiro-store.ts` | AlunoPerfil, Financeiro legacy, Contratos | `mysql-api`, planos-store | Financeiro, Contratos | Colecoes financeiras | N/A | Components/routes | Alto |
| `src/lib/contratos-store.ts` | Contratos, AlunoPerfil, Contrato dialogs | `remote-collection`, financeiro-store | Contratos, Alunos | `/state/contratos` | N/A | Components/routes | Alto |
| `src/lib/settings/settings-store.ts` | AppSidebar, Configuracoes, formularios, aulas | settings service/defaults | Configuracoes, Catalogos, UI | `/settings`/state indireto | N/A | Components/routes | Alto |
| `src/lib/responsavel-students-context.tsx` | Root provider, hooks responsavel | `api`, auth | Portal responsavel | `/responsavel/alunos` | N/A | Hooks de responsavel | Alto |
| `src/hooks/useDashboardAluno.ts` | Portal aluno dashboard | `api` | Portal aluno | `/aluno/me/dashboard` | N/A | Portal aluno | Medio |
| `src/hooks/useDashboardResponsavel.ts` | Portal responsavel dashboard | `api`, responsavel context | Portal responsavel | `/responsavel/dashboard` | N/A | Portal responsavel | Medio |
| `src/hooks/useFinanceiroAluno.ts` | Portal aluno financeiro | `api`, socket | Financeiro portal | `/aluno/me/financeiro` | N/A | Portal aluno | Alto |
| `src/hooks/useResponsavelFinanceiro.ts` | Portal responsavel financeiro | `api`, socket, responsavel context | Financeiro portal | `/responsavel/financeiro` | N/A | Portal responsavel | Alto |
| `src/hooks/useNotificacoesAluno.ts` | NotificationBell, portal aluno | `api`, socket | Notificacoes | `/aluno/me/notificacoes` | N/A | Components/routes | Medio/Alto |
| `src/hooks/useResponsavelNotificacoes.ts` | Portal responsavel notificacoes | `api`, socket, responsavel context | Notificacoes | `/responsavel/notificacoes` | N/A | Portal responsavel | Medio/Alto |
| `src/hooks/useContratoAluno.ts` | Portal aluno contrato | `api` | Contratos portal | `/aluno/me/contrato` | N/A | Portal aluno | Medio |
| `src/hooks/useResponsavelContratos.ts` | Portal responsavel contrato | `api`, responsavel context | Contratos portal | `/responsavel/contratos` | N/A | Portal responsavel | Medio |
| `backend/src/config/db.js` | Quase todo backend por `backend/db.js` ou direto | mysql2, dotenv | Todos os modulos com banco | N/A | Todas as tabelas principais | Routes/services/controllers | Critico |
| `backend/db.js` | `backend/auth.js`, services legados, `server/index.mjs` | `backend/src/config/db.js` | Backend todo | N/A | Todas via db.js | Services/routes | Critico |
| `backend/auth.js` | Auth routes, middlewares, alunos/professores/responsaveis/financeiro | db, jwt | Login, Usuarios, Permissoes | N/A | `users`, `j12_usuarios`, sessions, alunos, professores | Routes/middlewares/services | Critico |
| `backend/routes/auth.js` | `backend/src/server.js`, `server/index.mjs` | `backend/auth.js`, db | Login | `/auth/*` | Auth tables via service | Auth endpoints | Critico |
| `backend/src/utils/jwt.js` | `backend/auth.js` | crypto | Login | N/A | N/A | Auth | Critico |
| `backend/src/server.js` | `backend/server.js` | rotas, db, auth seed, CORS | API local | Todas montadas | Todas indiretas | Backend bootstrap | Critico |
| `server/index.mjs` | PM2/homologacao | backend routes/auth/db | API homolog/prod | Todas montadas | Todas indiretas | Backend bootstrap | Critico |
| `backend/src/routes/alunos.routes.js` | Bootstraps | alunos controller, auth, db | Cadastros | `/alunos` | `j12_alunos`, `j12_turmas` | Controller Alunos | Critico |
| `backend/src/controllers/alunos.controller.js` | alunos.routes | db | Cadastros | N/A | `j12_alunos`, `j12_alunos_*`, financeiro, presencas, contratos, notificacoes | Route alunos | Critico |
| `backend/src/routes/aluno.routes.js` | `server/index.mjs` | auth middleware, aluno controller | Portal aluno | `/aluno/me/*` | Indiretas | aluno controller | Alto |
| `backend/src/controllers/aluno.controller.js` | aluno.routes, dashboard routes | db | Portal aluno, Notificacoes, Contratos | N/A | `j12_alunos`, `student_presencas`, `student_notifications`, `student_contracts` | Portal routes | Alto |
| `backend/routes/aluno-me.js` | `backend/src/server.js` | db, auth, student-finance | Portal aluno legado | `/aluno/me/*` | `j12_alunos`, `student_*` | Routes | Alto |
| `backend/src/routes/responsaveis.routes.js` | Bootstraps | db, auth | Responsaveis, Portal responsavel | `/responsavel/*`, `/responsaveis` | `j12_responsaveis`, `j12_alunos`, `student_*` | Routes | Critico |
| `backend/routes/financeiro.js` | `backend/src/server.js` | db, auth, helpers, student-finance | Financeiro | `/financeiro/*` | Financeiro, alunos, despesas | Routes/services | Critico |
| `backend/src/routes/financeiro.routes.js` | `server/index.mjs` | db, auth, financeiro service | Financeiro | `/financeiro/*` | `j12_mensalidades`, `j12_alunos`, `j12_planos` | Service financeiro | Critico |
| `backend/services/student-finance.js` | Financeiro routes, aluno-me, Banco Inter | db | Financeiro portal/admin | N/A | `j12_financeiro_cobrancas`, `j12_mensalidades`, `j12_pagamentos`, `j12_planos` | Services/routes | Critico |
| `backend/src/services/bancoInter/financial.js` | Pix/webhook services | db, auth, student-finance | Financeiro/Pix | N/A | `financial_payments`, `inter_webhook_events`, financeiro | Banco Inter services | Critico |
| `backend/src/services/bancoInter/pix.js` | inter routes/index | auth inter, financial | Pix | Banco Inter externo | financial tables indiretas | Inter routes | Alto |
| `backend/src/routes/inter.routes.js` | Bootstraps | Banco Inter services | Pix/Webhooks | `/pix/*`, `/inter/*`, `/webhooks/inter` | financial/inter tables | Banco Inter services | Alto |
| `backend/src/routes/dashboard.routes.js` | Bootstraps | db, auth, birthday service | Dashboard/Portal | `/dashboard/*` | `j12_alunos`, `j12_mensalidades`, `student_*` | Dashboard service/controller inline | Alto |
| `backend/src/services/dashboard-birthdays.service.js` | dashboard.routes | db | Dashboard | N/A | `j12_alunos`, `j12_turmas`, `j12_unidades`, `j12_alunos_*` | Route dashboard | Medio/Alto |
| `backend/src/services/notificacao.service.js` | Modulos de notificacao | db | Notificacoes | N/A | `j12_notificacoes` | Routes/services | Medio |
| `backend/src/services/portal-schema.service.js` | Bootstraps/auth setup | db, bcrypt | Portais, Usuarios | N/A | `j12_usuarios`, `j12_presencas`, `j12_notificacoes`, `j12_contratos`, `student_*` | Services | Alto |
| `backend/services/linked-users.js` | professores/responsaveis | db | Usuarios, Professores, Responsaveis | N/A | `users`, `j12_professores`, `j12_alunos` | Routes/services | Alto |
| `backend/services/student-users.js` | Auth/cadastros | db | Usuarios, Alunos | N/A | `users`, `j12_alunos` | Auth/services | Alto |

## Backend - Arquivos por Familia

| Familia/arquivo | Quem importa | Importa | Modulos | APIs | Tabelas | Impacto |
| --- | --- | --- | --- | --- | --- | --- |
| `backend/src/controllers/aluno-completo.controller.js` | `aluno-completo.routes` | db | Cadastros | N/A | Planos, turmas, responsaveis, alunos | Alto |
| `backend/src/controllers/financeiro.controller.js` | Rotas financeiras antigas | db | Financeiro | N/A | `j12_configuracoes_financeiras`, `j12_mensalidades`, `j12_pagamentos` | Alto |
| `backend/src/controllers/public-enrollments.controller.js` | public.routes | db, ViaCEP fetch | Matricula publica | `/public/enrollments` | `j12_matriculas_publicas`, `j12_matricula_numeros` | Alto |
| `backend/src/controllers/public-catalog.controller.js` | public.routes | db | Catalogos publicos | `/public/*` | `j12_modalidades`, `j12_unidades`, `j12_turmas` | Medio |
| `backend/src/controllers/modalidades.controller.js` | rotas modalidades legadas | db | Catalogos | `/modalidades` | `j12_modalidades` | Medio |
| `backend/src/controllers/unidades.controller.js` | rotas unidades legadas | db | Catalogos | `/unidades` | `j12_unidades` | Medio |
| `backend/src/routes/professores.routes.js` | Bootstraps | db, linked-users | Professores, Usuarios | `/professores` | `j12_professores`, `users` | Alto |
| `backend/src/routes/turmas.routes.js` | Bootstraps | db | Turmas, Agenda | `/turmas` | `j12_turmas`, `j12_alunos`, `j12_professores` | Alto |
| `backend/src/routes/planos.routes.js` | Bootstraps | db | Planos, Financeiro | `/planos` | `j12_planos` | Alto |
| `backend/src/routes/modalidades.routes.js` | Bootstraps | db | Catalogos | `/modalidades` | `j12_modalidades` | Medio |
| `backend/src/routes/unidades.routes.js` | Bootstraps | db | Catalogos | `/unidades` | `j12_unidades` | Medio |
| `backend/src/routes/public.routes.js` | Bootstraps | public controllers | Matricula/Catalogos publicos | `/public/*` | Public/catalog tables | Alto |
| `backend/src/routes/presencas.routes.js` | Bootstraps | db | Presencas, Agenda | `/presencas` | `student_presencas`, `j12_turmas`, `j12_alunos` | Alto |
| `backend/src/routes/notificacoes.routes.js` | Bootstraps | db/auth | Notificacoes | `/notificacoes` | `student_notifications` | Medio |
| `backend/src/routes/perfil.routes.js` | `backend/src/server.js` | db/auth | Perfil aluno | `/aluno/me/perfil` | `j12_alunos` | Medio |
| `backend/src/routes/state.routes.js` | Bootstraps | db snapshots | Configuracoes/collections | `/state/:collection` | `j12_collection_snapshots` | Alto |
| `backend/routes/contratos.routes.js` | `server/index.mjs` | express | Contratos | `/contratos` | N/A atual | Medio |
| `backend/routes/settings.routes.js` | `server/index.mjs` | express | Configuracoes | `/settings` | N/A atual | Medio |
| `backend/routes/trial-classes.routes.js` | `server/index.mjs` | helpers/state | Aula experimental/Agenda | `/trial-classes` | snapshots | Medio |
| `backend/routes/helpers.js` | Financeiro/aluno-me/trial | N/A | Helpers backend | N/A | N/A | Medio |
| `backend/src/services/inter.service.js` | Inter routes | Banco Inter index | Pix | `/inter/*` indireto | financial tables indiretas | Medio |
| `backend/src/services/presencas.service.ts` | Nao identificado como rota principal | axios | Presencas externo | Externo | N/A | Baixo/Medio |
| `backend/src/middlewares/auth.middleware.js` | Rotas antigas/portal | `backend/auth.js` | Auth | N/A | Auth indireto | Alto |
| `backend/src/middlewares/error.middleware.js` | App legado | N/A | Erros backend | N/A | N/A | Medio |
| `backend/src/app.js` | Possivel app legado | inter routes | Inter/API | `/inter/*` | Indiretas | Medio |
| `backend/server.js` | Processo backend local | `backend/src/server.js` | Bootstrap | Todas | Indiretas | Alto |
| `server/routes/auth.mjs` | Nao principal; wrapper | backend auth | Auth legado | Auth | Auth tables | Medio |
| `server/routes/aluno.mjs` | `server/index.mjs` | db/auth JWT | Aluno financeiro legado | `/aluno/financeiro` | `j12_mensalidades` | Medio |
| `server/database.mjs` | Legado SQLite | sqlite | Legado | N/A | SQLite local | Alto se usado |
| `server/email.mjs` | Fluxos de email futuros | fetch Resend | Email | Resend API | N/A | Medio |
| `backend/scripts/criar-usuarios-completos.js` | Manual | db/bcrypt | Usuarios seed | N/A | `j12_alunos`, `j12_usuarios` | Alto se executado |

## Frontend - Arquivos por Familia

| Familia/arquivo | Quem importa | Importa | Modulos | APIs | Dependentes | Impacto |
| --- | --- | --- | --- | --- | --- | --- |
| `src/routes/login.tsx`, `forgot-password.tsx`, `reset-password.$token.tsx`, `primeiro-acesso.tsx`, `trocar-senha.tsx` | Router | AuthExperience/auth | Login | `/auth/*` indireto | Auth UI | Alto |
| `src/components/public/AuthExperience.tsx` | Login/public routes | UI/auth | Login | Indiretas | Login | Alto |
| `src/components/AppShell.tsx`, `AppSidebar.tsx` | Todas as rotas internas | auth, settings, UI | Navegacao/RBAC | N/A | Rotas | Alto |
| `src/components/ProtectedRoute.tsx`, `RequireAuth.tsx` | Rotas protegidas | auth | RBAC | N/A | Rotas | Alto |
| `src/components/layout/PortalShell.tsx`, `PortalAlunoLayout.tsx`, `PortalResponsavelLayout.tsx` | Portais | auth/layout/selector | Portais | N/A | Rotas portal | Alto |
| `src/routes/portal-aluno/*` | Router | hooks aluno, PortalAlunoLayout | Portal aluno | `/aluno/me/*` | Hooks portal | Medio/Alto |
| `src/routes/portal-responsavel/*` | Router | hooks responsavel, PortalResponsavelLayout | Portal responsavel | `/responsavel/*` | Hooks responsavel | Medio/Alto |
| `src/hooks/usePerfilAluno.ts`, `usePresencasAluno.ts`, `useFinanceiroAluno.ts`, `useNotificacoesAluno.ts`, `useContratoAluno.ts` | Portal aluno | api/socket | Portal aluno | `/aluno/me/*` | Rotas portal | Medio/Alto |
| `src/hooks/useResponsavelAlunos.ts`, `useResponsavelAlunoPerfil.ts`, `useResponsavelPresencas.ts`, `useResponsavelFinanceiro.ts`, `useResponsavelContratos.ts`, `useResponsavelNotificacoes.ts` | Portal responsavel | api/context/socket | Portal responsavel | `/responsavel/*` | Rotas portal | Medio/Alto |
| `src/routes/professores.tsx`, `src/components/professores/*`, `src/components/professor/ProfessorPresencasPage.tsx` | Router | professores-store, turmas/alunos API | Professores/Presencas | `/professores`, `/turmas`, `/alunos/turma`, `/presencas` | Rotas professor | Alto |
| `src/routes/turmas.tsx`, `src/components/turmas/*` | Router | turmas-store, alunos-store, professores | Turmas/Agenda | `/turmas` indireto | Turmas | Alto |
| `src/routes/contratos.tsx`, `src/components/contratos/*`, `src/lib/contratos-template.ts`, `src/lib/contratos-pdf.ts` | Router/AlunoPerfil | contratos-store, jsPDF | Contratos | `/state/contratos`, `/contratos` | Alunos/portais | Alto |
| `src/routes/configuracoes.tsx`, `src/components/settings/*`, `src/lib/settings/*` | Router/AppSidebar/forms | settings-store/service/defaults | Configuracoes | `/settings`, `/state` indireto | App inteiro | Alto |
| `src/routes/aula-experimental.tsx`, `src/components/aula-experimental/*`, `src/lib/trial-classes-store.ts` | Router/Dashboard | settings, professores, state | Agenda/Aula experimental | `/trial-classes`/state | Dashboard/Agenda | Medio |
| `src/routes/agenda.tsx` | Router | auth | Agenda redirect | N/A | Portais | Baixo/Medio |
| `src/routes/presenca.tsx`, `src/routes/presencas.tsx`, `src/components/presenca/PresencePage.tsx` | Router | presenca access, stores | Presencas | Indiretas | Turmas/professor | Medio |
| `src/routes/financeiro.tsx`, `src/components/financeiro/BaixaDialog.tsx`, `CobrancaDialog.tsx` | Router | financeiro-store | Financeiro legado/self-service | Financeiro indireto | Financeiro | Medio/Alto |
| `src/lib/mysql-api.ts`, `mysql-resource-store.ts`, `remote-collection.ts` | Stores | api/auth-storage | Stores remotas | `/state`, recursos MySQL | Stores | Alto |
| `src/lib/modalidades-store.ts`, `unidades-store.ts`, `planos-store.ts`, `responsaveis-store.ts` | Forms/settings/routes | api/mysql store | Catalogos | `/modalidades`, `/unidades`, `/planos`, `/responsaveis` | Cadastros | Alto |
| `src/lib/public-catalog-hooks.ts`, `matricula-api.ts`, `aluno-matricula.ts` | Matricula publica | api/mysql-api | Matricula publica | `/public/*`, `/public/enrollments` | Matricula | Medio/Alto |
| `src/lib/presenca-access.ts` | Presenca/professor | auth, professores, settings | Presencas/RBAC | N/A | Presenca | Medio |
| `src/lib/socket.ts` | Financeiro/notificacoes hooks | socket.io client | Realtime | Socket.IO | Hooks | Alto |
| `src/lib/branding.ts`, `ssr-debug.ts`, `utils.ts` | UI/layouts | Assets/log helpers | Cross-cutting | N/A | Muitos componentes | Medio |
| `src/stores/system-store.ts`, `src/ConfigContext.tsx` | Uso limitado/legado | api | Sistema/config legado | `/api/config/*`, system | Config | Medio |
| `src/types/BirthdayTypes.ts` | BirthdayService/hooks/components | N/A | Dashboard | N/A | Birthday | Baixo |

## UI Primitives

Arquivos em `src/components/ui/*.tsx` sao baixo impacto isolado, mas medio impacto visual quando alterados porque muitos componentes os consomem. Todos importam React/Radix/lucide/cn conforme o componente e nao consomem APIs nem tabelas.

| Arquivos | Quem importa | Impacto |
| --- | --- | --- |
| `accordion`, `alert`, `alert-dialog`, `aspect-ratio`, `avatar`, `badge`, `breadcrumb`, `button`, `calendar`, `card`, `carousel`, `chart`, `checkbox`, `collapsible`, `command`, `context-menu`, `dialog`, `drawer`, `dropdown-menu`, `form`, `hover-card`, `input`, `input-otp`, `label`, `menubar`, `navigation-menu`, `pagination`, `popover`, `progress`, `radio-group`, `resizable`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `slider`, `sonner`, `switch`, `table`, `tabs`, `textarea`, `toggle`, `toggle-group`, `tooltip` | Rotas, dialogs, settings, financeiro, alunos, dashboard e layout | Baixo isolado / Medio visual |

## Arquivos Gerados, Legados e Auxiliares

| Arquivo | Classificacao | Acao recomendada |
| --- | --- | --- |
| `src/routeTree.gen.ts` | Gerado, alto impacto operacional | Nao editar manualmente. Regenerar via TanStack Router. |
| `src/routes/-financeiro.routes.js` | Legado/estranho em pasta frontend | Nao migrar sem confirmar se e artefato. |
| `src/routes/-backend-aluno.routes.js` | Legado/estranho em pasta frontend | Nao migrar sem confirmar se e artefato. |
| `server/database.mjs` | SQLite legado, alto se usado | Manter intacto ate decisao formal. |
| `backend/src/routes/auth.routes.js` | Auth legado com risco documentado | Nao montar sem revisao; candidato a isolamento futuro. |
| `backend/routes/alunos.js` | Alias para rota atual | Manter por compatibilidade. |
| `backend/routes/modalidades.routes.js`, `unidades.routes.js` | Wrappers legados | Manter ate consolidar rotas. |

## Observacoes

- Arquivos que acessam banco diretamente no backend foram classificados no minimo como medio impacto.
- Arquivos que fazem mutacao financeira, auth ou cadastro foram classificados como alto ou critico.
- Arquivos de UI sem API foram classificados como baixo impacto isolado.
- Componentes financeiros e de alunos sao alto impacto mesmo sendo frontend, porque acionam mutacoes e exibem dados sensiveis.

## Links Relacionados

- [Mapa de Impacto](./MAPA_IMPACTO.md)
- [Modulos Criticos](./MODULOS_CRITICOS.md)
- [Checklist de Migracao](../REFATORACAO/CHECKLIST_MIGRACAO.md)
