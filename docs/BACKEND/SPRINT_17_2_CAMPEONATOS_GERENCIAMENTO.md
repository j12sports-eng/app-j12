# Sprint 17.2 - Gerenciamento de Campeonatos

## Objetivo

Concluir o gerenciamento administrativo do cadastro de Campeonatos sem implementar equipes, atletas, jogos, tabelas, sumulas, estatisticas, classificacao ou portal publico.

## Alteracoes

- Expostos endpoints administrativos para publicar e arquivar campeonato.
- Mantidos endpoints de listar, detalhar, criar, atualizar e remover.
- Adicionada validacao de periodo em atualizacao parcial de `startDate` ou `endDate`.
- Registrado metadado `CHAMPIONSHIP_ADMIN_ACCESS_POLICY` para futura permissao granular.
- Preparada estrutura `metadata.logo` para referencia futura de logo.
- Preparadas referencias futuras de escudo/logo de equipe com `fileId`, `storageKey` e `publicUrl`, sem upload.
- Preparada estrutura de comissao tecnica de equipe apenas como dados embutidos, sem CRUD especifico.

## Logo

O upload real de logo nao foi implementado nesta sprint.

A API aceita somente metadados de referencia futura em `logo` ou `metadata.logo`, como `fileId`, `storageKey`, `publicUrl`, `originalName`, `mimeType` e `sizeBytes`. Payloads com `file`, `buffer`, `base64`, `blob` ou campos equivalentes sao rejeitados.

O armazenamento definitivo deve ser implementado em sprint futura, quando o modulo de arquivos estiver consolidado.

## Equipes

O escudo/logo de equipe fica preparado apenas por referencia (`fileId`, `storageKey`, `publicUrl` ou alias equivalente). Nao ha upload real de arquivo nesta sprint.

A comissao tecnica fica representada somente como estrutura futura (`name`, `role`, `phone`, `email`) vinculada ao contrato de equipe. Nao foi criado CRUD especifico de comissao tecnica; a gestao detalhada fica para sprint posterior.

## Rotas

Base:

- `/admin/campeonatos`
- `/api/admin/campeonatos`

Endpoints:

- `GET /`
- `GET /:id`
- `POST /`
- `POST /:id/publish`
- `POST /:id/archive`
- `PUT /:id`
- `DELETE /:id`

## Autorizacao

A Sprint 17.2 preserva exatamente o padrao atual do dominio:

- `requireAuth`
- `canManageSystem`

Nenhum middleware novo foi criado. Nenhum contrato de autenticacao, perfil ou usuario foi alterado.
