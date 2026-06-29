# Roadmap

Roadmap de evolucao arquitetural do App J12, separado por fases para reduzir risco.

## Indice

- [Objetivo](#objetivo)
- [Principios](#principios)
- [Fase 0 - Estabilizacao](#fase-0---estabilizacao)
- [Fase 1 - Contratos e Documentacao Viva](#fase-1---contratos-e-documentacao-viva)
- [Fase 2 - Banco e Integridade](#fase-2---banco-e-integridade)
- [Fase 3 - Backend Modular](#fase-3---backend-modular)
- [Fase 4 - Frontend por Dominio](#fase-4---frontend-por-dominio)
- [Fase 5 - Observabilidade e Operacao](#fase-5---observabilidade-e-operacao)
- [Links Relacionados](#links-relacionados)

## Objetivo

Evoluir a plataforma sem interromper operacao de alunos, financeiro, presencas, portais e autenticacao.

## Principios

- Preservar compatibilidade.
- Refatorar por dominio, nao por camada global.
- Consolidar fonte de verdade antes de remover codigo legado.
- Versionar schema antes de impor constraints.
- Validar sempre em homologacao.

## Fase 0 - Estabilizacao

- Consolidar branch `homolog`.
- Registrar hash implantado em producao e homologacao.
- Resolver worktree sujo.
- Padronizar `.env.example`.
- Confirmar entrada oficial da API em PM2.

## Fase 1 - Contratos e Documentacao Viva

- Manter estes documentos como referencia oficial.
- Criar mapa automatizado de rotas.
- Documentar payloads principais.
- Registrar decisoes arquiteturais novas em [Decisoes](./DECISOES.md).

## Fase 2 - Banco e Integridade

- Transformar `ensureSchema` em migrations versionadas.
- Definir modelo Pessoa unificado.
- Mapear FKs reais e FKs logicas.
- Criar indices para consultas de dashboard, financeiro e portais.
- Planejar migracao de JSONs para tabelas relacionais quando necessario.

## Fase 3 - Backend Modular

- Eleger um bootstrap unico.
- Separar `routes`, `controllers`, `services`, `repositories` e `middlewares`.
- Remover rotas legadas apos prova de nao uso.
- Padronizar resposta JSON e tratamento de erro.

## Fase 4 - Frontend por Dominio

- Consolidar stores por dominio.
- Definir quando usar React Query e quando usar store customizada.
- Reduzir `any`.
- Corrigir textos com encoding quebrado.
- Padronizar componentes de dashboard, tabelas e formularios.

## Fase 5 - Observabilidade e Operacao

- Estruturar logs JSON por request id.
- Criar healthchecks por dependencia.
- Documentar runbooks PM2/Nginx/SSL.
- Adicionar backups periodicos e teste de restore.

## Links Relacionados

- [Auditoria](./AUDITORIA.md)
- [Backend Padroes](../BACKEND/PADROES.md)
- [Frontend Padroes](../FRONTEND/PADROES.md)
- [Banco Integridade](../BANCO/INTEGRIDADE.md)

