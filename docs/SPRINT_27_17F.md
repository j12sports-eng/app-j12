# Sprint 27.17F — superfície interna de Leads CRM

## Escopo entregue

A superfície canônica está em `/admin/crm/leads`, dentro da arquitetura TanStack Router e `AppShell`. O item `Leads CRM` aparece no menu operacional somente para `admin` e `coordenador`; a rota também usa `ProtectedRoute` com os mesmos papéis.

O frontend usa exclusivamente `src/lib/api.ts` e os endpoints internos já publicados pela Sprint 27.17E.2:

- `GET /internal/crm/leads` (também `/api/internal/crm/leads`);
- `GET /internal/crm/leads/:leadId`;
- `POST /internal/crm/leads/:leadId/draft-enrollment`.

A listagem usa React Query com `useInfiniteQuery`, cursor opaco e filtros suportados pelo backend (`stage`, `status`, `conversionStatus`, `unitId`, `limit`). Não há busca textual, `totalCount`, OFFSET ou chamadas por linha.

## Contratos de frontend

Os tipos canônicos estão em `src/features/crm/types/crm-lead.types.ts`. As chaves são centralizadas em `crmLeadQueryKeys`; a lista usa `all/list(filters)` e o detalhe usa `detail(leadId)`. A conversão invalida a lista e o detalhe após sucesso.

O detalhe exibe somente o PII comercial permitido pelo contrato (`nome`, `email`, `telefone`), estágio, status, unidade, elegibilidade e estado das conversões. Nenhum PII é escrito em `localStorage`, `sessionStorage` ou logs.

O preview abre um diálogo separado e começa com dados de aluno em branco: `nome`, `dataNascimento`, `sexo`, campos opcionais de contato/CPF e `startDate`. O contato do Lead nunca é copiado automaticamente. A confirmação envia exatamente:

```json
{
  "studentData": {
    "nome": "...",
    "dataNascimento": "YYYY-MM-DD",
    "sexo": "M|F|OUTRO",
    "cpf": "...",
    "email": "...",
    "telefone": "..."
  },
  "enrollmentData": { "startDate": "YYYY-MM-DD" },
  "idempotencyKey": "uuid"
}
```

`leadId` permanece somente na URL. `unitId` e `userId` nunca são enviados pelo frontend. A chave de idempotência é efêmera por abertura do diálogo e não é persistida. A UI comunica que a operação cria/reutiliza Pessoa, Perfil de Aluno e matrícula `DRAFT`; não ativa, não cobra, não escolhe turma, não cria contrato e não notifica.

O sucesso consome o resultado tipado com `conversionStatus`, `enrollmentStatus`, `resolutions` e `reused`. O diálogo mostra apenas se Pessoa, Perfil e Matrícula foram criados ou reutilizados e confirma `DRAFT`; não exibe PII, payload técnico nem IDs internos.

Erros do backend são convertidos para mensagens seguras, incluindo `CRM_INPUT_INVALID`, `CRM_LEAD_NOT_FOUND`, `CRM_LEAD_UNIT_CONTEXT_UNAVAILABLE`, `CRM_ACCESS_DENIED`, `CRM_LEAD_UNIT_CONTEXT_FAILED` e conflitos de conversão/matrícula. O backend continua sendo a fonte final de elegibilidade e autorização; retries permanecem seguros pela idempotência da API.

## Acessibilidade e responsividade

Tabela com foco e ativação por Enter/espaço no desktop, cartões acionáveis no mobile, `role=alert`, `aria-live` para envio e estados de skeleton/erro/vazio. Os diálogos têm rolagem limitada à viewport e formulários em grid responsivo.

## Validação e limites

Foram adicionados testes de contrato estáticos em `src/features/crm/tests/crm-leads.frontend.test.mjs`, sem React montado e sem dependência de banco externo. A Sprint F não altera backend, migrations, schema, índices ou execução MySQL; não implementa listagem/detalhes além da superfície CRM, nem matrícula ativa, financeiro, frontend público ou as Sprints MySQL suspensas. O filtro de unidade é um filtro administrativo textual porque não há catálogo de unidades no contrato desta sprint.

Riscos residuais:

- a autorização continua global para `admin`/`coordenador`, conforme `canManageSystem`;
- o filtro de unidade depende de ID digitado, pois esta sprint não possui catálogo;
- os testes do componente são contratuais/estáticos; um E2E autenticado continua necessário para validar foco e integração HTTP em navegador.

Permanecem suspensas, sem alteração: 27.17A.4.1C.1, 27.17A.4.1E e 27.17A.4.2.

Próximos passos: Sprint 27.17G — Observabilidade e Auditoria Operacional da Conversão; depois, Sprint 27.17H — Histórico Visual de Conversões no CRM. Nenhum deles deve ativar matrícula automaticamente.
