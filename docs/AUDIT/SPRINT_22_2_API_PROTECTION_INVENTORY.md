# Sprint 22.2 - Inventário de proteção das APIs

Classificação: A protegida; B protegida com dependência operacional; C autenticação/escopo parcial; D indevidamente pública; E pública intencional; F não comprovada.

| Área | Paths principais | Proteção | Classe |
| --- | --- | --- | --- |
| Auth | `/auth/login`, forgot/reset/first-access | públicos intencionais, validação e rate limit específico | E |
| Auth self | `/auth/me`, logout, change-password | Bearer `requireAuth` | A |
| Aluno | `/aluno/me/*` | Bearer + ID do token | A |
| Responsável | `/responsavel/me/*`, `/alunos/:alunoId/*` | Bearer + vínculo persistido | A |
| Professor/presença | `/professor/me`, `/presencas` | Bearer + ownership de turma/aluno | A após 22.2 |
| Cadastros administrativos | alunos, responsáveis, professores, turmas, unidades, modalidades, planos | Bearer; mutations gerenciais | B; rotas legadas ainda heterogêneas |
| Matrículas | `/admin/enrollments`, internal/public | admin/interno; pública protegida pelo padrão atual | B |
| Financeiro/Payment/Inter | `/admin/financeiro/*` | `requireAuth` + `canManageSystem` | A local, B operacional |
| Automação/histórico | `/internal/financeiro/automacoes`, histórico admin | token/origin/rate limit ou gestão | A local, B operacional |
| BI/exports | `/admin/bi/*` | `requireAuth` + `canManageSystem`, limites/allowlists | A |
| Agenda | `/admin/agenda` | gestão | A |
| Quadras | `/admin/quadras` | gestão | A |
| Campeonatos admin | `/admin/campeonatos` | gestão | A |
| Campeonatos público | `/public/campeonatos` | DTO sanitizado read-only | E |
| Notificações | admin e centro do usuário | gestão ou recipient scope do token | A |
| Health | `/health`, `/api/health` | público, sem secrets | E |
| Configurações/trial classes legadas | `/settings`, `/trial-classes` | composition/guards legados | C; funcionalidade/mocks tratados em 22.4 |

Todos os routers modernos agora são montados pelo processo configurado no PM2. Não foi encontrada rota sensível moderna deliberadamente anônima. Rotas públicas intencionais continuam sujeitas a validação de payload e rate limit global.
