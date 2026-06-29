# Checklist Pre Refatoracao

Checklist obrigatorio para qualquer alteracao relevante no App J12.

## Indice

- [Uso](#uso)
- [Git](#git)
- [Backup](#backup)
- [Frontend](#frontend)
- [Backend](#backend)
- [APIs](#apis)
- [Banco](#banco)
- [Autenticacao e Permissoes](#autenticacao-e-permissoes)
- [Testes](#testes)
- [Deploy e Homologacao](#deploy-e-homologacao)
- [Links Relacionados](#links-relacionados)

## Uso

Marque cada item antes de iniciar uma refatoracao. Itens nao aplicaveis devem ser justificados no commit ou PR.

## Git

- [ ] `git status --short` revisado.
- [ ] Branch correta confirmada.
- [ ] Alteracoes locais nao relacionadas identificadas.
- [ ] Arquivos `.env` preservados.
- [ ] Plano de rollback definido.

## Backup

- [ ] Backup do banco MySQL criado quando houver impacto em dados.
- [ ] Backup de `.env` local feito fora do Git.
- [ ] Certificados em `certs/` preservados.
- [ ] Hash atual da VPS registrado antes do deploy.

## Frontend

- [ ] Rotas TanStack afetadas identificadas.
- [ ] Componentes reutilizados antes de criar novos.
- [ ] Stores/hooks impactados mapeados.
- [ ] Estados de loading, erro e vazio preservados.
- [ ] Responsividade mobile verificada.
- [ ] Autorizacao visual e redirecionamentos revisados.

## Backend

- [ ] Bootstrap ativo identificado: `backend/src/server.js` ou `server/index.mjs`.
- [ ] Rotas Express afetadas mapeadas.
- [ ] Middlewares de auth, CORS, rate limit e erro revisados.
- [ ] Tratamento de erro retorna JSON consistente.
- [ ] Logs nao expõem senha, token ou segredos.

## APIs

- [ ] URL consumida pelo frontend confirmada.
- [ ] Prefixos `/api`, `/__api` e rota sem prefixo avaliados.
- [ ] Contrato de resposta documentado.
- [ ] Status HTTP esperados revisados.
- [ ] Compatibilidade com SSR/proxy mantida.

## Banco

- [ ] Tabelas envolvidas identificadas em `backend/src/config/db.js`.
- [ ] Indices existentes conferidos.
- [ ] Relacionamentos por `*_id` e JSON mapeados.
- [ ] Backfill ou sincronizacao legado/J12 revisados.
- [ ] Integridade referencial avaliada.

## Autenticacao e Permissoes

- [ ] Papel do usuario requerido identificado.
- [ ] `requireAuth`, `requireRole`, `canManageSystem` e `resolveScopedStudentId` considerados.
- [ ] Portais aluno/responsavel testados quando houver impacto.
- [ ] JWT e sessoes mantidos compativeis.

## Testes

- [ ] Build frontend executado.
- [ ] `node --check` em arquivos backend alterados.
- [ ] Fluxo de login validado.
- [ ] CRUD afetado validado.
- [ ] `/health` validado.
- [ ] Logs de erro revisados.

## Deploy e Homologacao

- [ ] Variaveis de ambiente de homologacao conferidas.
- [ ] PM2 reiniciado com `--update-env` quando necessario.
- [ ] Nginx/proxy validado para `/api`, `/__api`, `/auth` e `/socket.io`.
- [ ] Smoke test de homologacao concluido.
- [ ] Hash do commit implantado registrado.

## Links Relacionados

- [Preparacao Git](./PREPARACAO_GIT.md)
- [Auditoria](./AUDITORIA.md)
- [Backend API](../BACKEND/API.md)
- [Deploy Checklist](../DEPLOY/CHECKLIST.md)

