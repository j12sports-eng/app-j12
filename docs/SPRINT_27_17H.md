# Sprint 27.17H — Histórico Visual de Conversões no CRM

## Gate arquitetural e fonte persistida

A fonte canônica escolhida é `crm_lead_enrollment_conversions`. A migration existente persiste:

- `id`, `lead_id` e `unit_id`;
- `person_id` e `person_profile_id`;
- `enrollment_id` e `enrollment_status`;
- `status`, `converted_by` e `converted_at`;
- `idempotency_key` e `metadata_json`, que não são selecionados nem expostos pelo histórico.

`crm_lead_student_conversions` foi auditada, mas não é necessária para a projeção porque os IDs de Pessoa e perfil já estão na conversão final. A consulta não acessa `people`, `person_profiles` ou `enrollments` e não executa JOIN ou N+1.

Os eventos `STARTED`, `SUCCEEDED` e `FAILED` da Sprint 27.17G são enviados ao logger estruturado e aos arquivos operacionais do PM2. O repositório não possui coletor, API de consulta ou retenção comprovada que permita tratá-los como fonte histórica. As métricas process-local também não são fonte persistida.

Consequentemente, a Sprint H apresenta apenas conversões `COMPLETED` persistidas. Não existe reconstrução fictícia de tentativas ou falhas.

## Campos disponíveis e ausentes

A API retorna somente IDs operacionais, unidade, ator, data, status da conversão e estado `DRAFT` da matrícula. `source` identifica a tabela canônica no detalhe.

Os seguintes campos não existem na tabela e são retornados como `null`:

- `correlationId`;
- resoluções `person`, `profile` e `enrollment`;
- flags `reused` correspondentes;
- `version`.

O frontend comunica “Não persistido” para esses campos. Nenhuma inferência é feita a partir de retries, ausência de registros, metadata arbitrária ou logs efêmeros.

## Endpoints e segurança

Rotas internas somente leitura:

- `GET /internal/crm/conversions`;
- `GET /api/internal/crm/conversions`;
- `GET /internal/crm/conversions/:conversionId`;
- `GET /api/internal/crm/conversions/:conversionId`.

A ordem permanece `requireAuth → ensureCrmInternalAccess → controller`. Sem autenticação retorna `401`; sem papel administrativo/coordenador retorna `403` e `CRM_ACCESS_DENIED`; detalhe inexistente retorna `404` e `CRM_CONVERSION_HISTORY_NOT_FOUND`.

O controller não importa repository. Falhas de infraestrutura são sanitizadas como `CRM_CONVERSION_HISTORY_FAILED`, sem SQL, stack, host, credenciais ou payload original.

## Filtros e paginação

A listagem aceita exclusivamente filtros suportados por colunas reais:

- `cursor`;
- `limit`;
- `leadId`;
- `unitId`;
- `convertedBy`;
- `enrollmentStatus`, limitado a `DRAFT`;
- `dateFrom`;
- `dateTo`.

`resolution`, `reused`, busca textual e campos desconhecidos são rejeitados com `CRM_INPUT_INVALID`. O limite padrão é 50 e o máximo é 100.

A paginação não usa OFFSET ou `totalCount`. O cursor opaco e versionado contém somente `converted_at + id`, com ordenação determinística `converted_at DESC, id DESC`. O repository aplica limite máximo independente, parâmetros separados e seleção estreita em uma única query.

## Resposta

Envelope da listagem:

```json
{
  "success": true,
  "data": {
    "items": [],
    "pageInfo": {
      "hasNextPage": false,
      "nextCursor": null
    }
  }
}
```

Cada item expõe:

```json
{
  "id": "conversion-id",
  "leadId": "lead-id",
  "unitId": "unit-id",
  "personId": "person-id",
  "personProfileId": "profile-id",
  "enrollmentId": "enrollment-id",
  "enrollmentStatus": "DRAFT",
  "conversionStatus": "COMPLETED",
  "convertedBy": "user-id",
  "convertedAt": "2026-07-18T20:00:00.000Z",
  "correlationId": null,
  "resolutions": { "person": null, "profile": null, "enrollment": null },
  "reused": { "person": null, "profile": null, "enrollment": null }
}
```

O detalhe acrescenta `source: "crm_lead_enrollment_conversions"` e `version: null`.

## PII

O SELECT não contém nome, CPF, e-mail, telefone, nascimento, sexo, contato do Lead, idempotency key ou metadata. A resposta e o frontend não exibem esses campos e não usam `localStorage`, `sessionStorage`, logs de filtros ou `dangerouslySetInnerHTML`.

## Frontend

A subrota protegida `/admin/crm/conversions` foi adicionada ao `AppShell` e ao menu operacional como “Histórico CRM”, somente para `admin` e `coordenador`.

A tela oferece:

- filtros por Lead, unidade, usuário, status e período;
- tabela acessível no desktop e cards em telas menores;
- loading, erro, vazio e carregamento incremental;
- diálogo de detalhe com foco gerenciado pelo componente Dialog;
- IDs operacionais, status `DRAFT`, origem persistida e limitações explícitas.

O detalhe apresenta obrigatoriamente:

> Este histórico apresenta conversões concluídas. Tentativas e falhas são registradas apenas na infraestrutura externa de logs.

As query keys são próprias (`crmConversionHistory` e `crmConversionHistoryDetail`). Depois de uma conversão bem-sucedida, React Query invalida o histórico, a lista de Leads e o detalhe do Lead. Não foi criado store paralelo.

## Compatibilidade, migration e MySQL

A implementação é aditiva. Permanecem inalterados:

- POST de conversão e seu payload/resposta;
- GETs de Leads;
- contexto confiável de unidade;
- autorização e autenticação;
- observabilidade da Sprint 27.17G;
- matrícula somente `DRAFT`.

Nenhuma migration ou alteração de schema foi criada. Nenhuma execução ou conexão a MySQL externo é necessária para os testes; repositories e fronteiras são exercitados com injeção de dependência.

## Testes, limitações e riscos

Os testes cobrem service, repository, controller, aliases de rota, autenticação, autorização, paginação, cursor, limites, filtros, 404, sanitização, ausência de PII, responsividade contratual, acessibilidade, detalhe e invalidação.

Limitações e riscos conhecidos:

- tentativas e falhas não são consultáveis pelo produto;
- `correlationId`, resoluções, reuso e versão não foram persistidos retrospectivamente;
- a ordenação por `converted_at + id` não possui índice composto dedicado; nenhuma migration foi criada nesta Sprint;
- o filtro de usuário utiliza o identificador persistido, sem consulta a Pessoas;
- testes frontend são contratuais/estáticos; um E2E autenticado continua recomendado para validar foco e integração visual em navegador real;
- a autorização CRM continua global para administradores e coordenadores.

As Sprints 27.17A.4.1C.1, 27.17A.4.1E e 27.17A.4.2 permanecem suspensas. Não foram retomados diagnóstico físico, índice UNIQUE ou MySQL operacional.

Próximo passo possível, sem início automático: Sprint 27.17I — Exportação Operacional do Histórico, somente se houver necessidade real; alternativamente, Sprint 27.18 — Evolução do Funil CRM.
