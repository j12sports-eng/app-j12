# Sprint 22.5 — Portais, autenticação e ownership

Base auditada: `fcf576499c91b8726ad6ce53a120da0717b7acfd`, branch `sprint-22`.

## Matriz do Portal do Aluno

| Área                    | API real                         | Escopo no backend     | Estado    |
| ----------------------- | -------------------------------- | --------------------- | --------- |
| Dashboard               | `/aluno/me/dashboard`            | `studentId` da sessão | Protegido |
| Perfil                  | `/aluno/me` e `/aluno/me/perfil` | `studentId` da sessão | Protegido |
| Agenda                  | `/aluno/me/agenda`               | `studentId` da sessão | Protegido |
| Presenças               | `/aluno/me/presencas`            | `studentId` da sessão | Protegido |
| Financeiro/mensalidades | `/aluno/me/financeiro`           | `studentId` da sessão | Protegido |
| Notificações            | `/aluno/me/notificacoes`         | `studentId` da sessão | Protegido |
| Contrato                | `/aluno/me/contrato`             | `studentId` da sessão | Protegido |
| Carteirinha             | `/aluno/me/carteirinha`          | `studentId` da sessão | Protegido |

O cliente não fornece `alunoId` nessas rotas. O backend deriva o titular de `req.auth`, impedindo troca de identificador por IDOR.

## Matriz do Portal do Responsável

| Área                      | API real                              | Escopo no backend              | Múltiplos dependentes |
| ------------------------- | ------------------------------------- | ------------------------------ | --------------------- |
| Dependentes               | `/responsavel/alunos`                 | vínculos recalculados no banco | lista autorizada      |
| Dashboard/agenda resumida | `/responsavel/dashboard`              | família ou `alunoId` vinculado | suportado             |
| Perfil/documentos         | `/responsavel/alunos/:alunoId/perfil` | exige vínculo                  | seleção individual    |
| Presenças                 | `/responsavel/presencas`              | família ou `alunoId` vinculado | suportado             |
| Financeiro/mensalidades   | `/responsavel/financeiro`             | família ou `alunoId` vinculado | suportado             |
| Notificações              | `/responsavel/notificacoes`           | família ou `alunoId` vinculado | suportado             |
| Contratos                 | `/responsavel/contratos`              | família ou `alunoId` vinculado | suportado             |

A seleção é persistida por usuário. Cada consulta inclui o dependente na identidade da requisição; respostas obsoletas são descartadas após troca. A agenda existente é o resumo de próximas aulas retornado pelo dashboard, não uma API autônoma.

## Segurança observada

- Sem bearer token: `401` em `requireAuth`.
- Perfil autenticado fora do permitido: `403` em `requireRole` ou no guard do responsável.
- `alunoId` arbitrário no Portal do Responsável: `403` antes da consulta dos dados funcionais.
- Portal do Aluno: não aceita `alunoId` do cliente; usa somente o vínculo da sessão.
- Pix: a rota exige autenticação, carrega a cobrança pelo identificador e executa `assertPaymentAccess` antes de qualquer chamada ao Banco Inter.
- Status do Pix: exige ownership da cobrança ou perfil de gestão.

Nenhuma cobrança, chamada ao Banco Inter, webhook, conciliação, migration ou operação externa foi executada nesta Sprint.

## Limites de homologação

Os testes locais comprovam guards, composição das rotas e invariantes de ownership. Permanecem externos: E2E em browser com sessões reais, banco isolado/HML contendo múltiplos vínculos, validação do schema implantado e sandbox certificado do Banco Inter. Esses itens impedem declarar 100% ou liberar produção apenas com esta auditoria.
