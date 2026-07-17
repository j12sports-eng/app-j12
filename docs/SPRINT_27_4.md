# Sprint 27.4 — Preview de Alunos do Centro de Comando

## Arquitetura encontrada

O módulo de BI de Alunos já fornece um contrato agregado e somente leitura em `GET /api/admin/bi/students`, protegido por autenticação e permissão administrativa. O fluxo existente é API, contrato tipado, provider, adapter e hook. A infraestrutura compartilhada da Sprint 27.3 fornece shell, campos, estados, recarga, opções de consulta e registro tipado de previews.

## Fonte e indicadores

O preview reutiliza a consulta `CURRENT_MONTH` da API existente, sem endpoint ou alteração de backend. São apresentados apenas `activeStudents`, `activeEnrollments`, `newStudents` e `newEnrollments`. Distribuições e evolução permanecem agregadas no contrato. Nenhum nome, documento, contato ou outro dado pessoal é consumido ou exibido.

As métricas de cancelamento, churn, crescimento líquido, retenção e tempo médio não possuem base canônica completa na fonte atual. Elas são normalizadas como indisponíveis com motivo explícito e não são estimadas.

## Componentes e integração

- `StudentsCommandCenterPreview`: composição do preview e de seus estados.
- `students-preview-provider`: ligação somente leitura com a API BI existente.
- `students-preview-normalizer`: validação defensiva e adaptação para o contrato comum.
- Rota administrativa protegida e condicionada pela feature flag existente.
- Registro central atualizado após o preview Financeiro, mantendo ordem determinística.

O preview reutiliza `PreviewShell`, `PreviewStatePanel`, `PreviewReloadButton`, `PreviewField`, `createPreviewQueryOptions`, o provider/adapter/hook genéricos e o registro tipado. Não há duplicação local desses componentes.

## Estados e resiliência

Há tratamento explícito para carregamento inicial, erro inicial com recarga, resultado vazio, sucesso, atualização em andamento e falha de atualização com preservação dos últimos dados válidos. Valores inválidos, ausentes ou não finitos são convertidos em indisponibilidade segura.

## Impacto e compatibilidade

Não foram alterados backend, banco, endpoints, contratos públicos ou comportamento do Preview Financeiro. A entrega adiciona somente a integração frontend de Alunos e deixa o registro compartilhado pronto para novos previews agregados.

## Validação

Foram previstos typecheck, lint do Centro de Comando, build de cliente e SSR, testes de normalização/integração do preview, suíte existente do Centro de Comando e testes existentes do BI de Alunos.
