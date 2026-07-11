# Sprint 22.1 - Roadmap para producao

O roadmap deriva dos riscos comprovados e nao inicia nenhuma fase abaixo.

## Metodologia de maturidade

Foram avaliadas oito dimensoes, com pesos orientados a risco: funcional 25%, integracao frontend/backend 15%, banco/migrations 15%, testes 10%, seguranca 15%, E2E/homologacao 10% e infraestrutura/producao 10%. Cada dimensao recebe evidencia entre 0 e 100; a media ponderada evita que volume de telas compense falta de seguranca ou operacao.

| Dimensao                | Nota | Peso | Evidencia limitante                                                                                       |
| ----------------------- | ---: | ---: | --------------------------------------------------------------------------------------------------------- |
| Implementacao funcional |  72% |  25% | Muitos modulos existem; professor, settings, avaliacao, lanchonete/estoque e mobile incompletos/ausentes. |
| Frontend/backend        |  60% |  15% | Composition root PM2 desconecta dominios modernos.                                                        |
| Banco/migrations        |  55% |  15% | Migrations existem, mas HML/producao e drift nao comprovados.                                             |
| Testes                  |  68% |  10% | Boa cobertura unitaria; pouca prova E2E/integracao real.                                                  |
| Seguranca               |  58% |  15% | Guards existem; IDOR, dois stacks e logs exigem hardening.                                                |
| E2E/homologacao         |  30% |  10% | Sem suite global atual em ambiente controlado.                                                            |
| Infra/producao          |  42% |  10% | PM2/Nginx existem; CI, restore e observabilidade faltam.                                                  |

Percentual geral ponderado: **58,8%**, arredondado para **59%**. Margem de incerteza: aproximadamente 5 pontos, pois nao houve ambiente real.

Indicadores complementares:

- percentual funcional: **72%**;
- pronto para homologacao: **48%** dos modulos/fluxos ponderados;
- pronto para producao: **18%**, limitado a componentes isolados, nao ao sistema integrado;
- Sprint 22.1: **100%** quando os quatro artefatos e gates finais estiverem registrados.

## Fases recomendadas

### 22.2 - Composition root, rotas e seguranca

Unificar o entrypoint de API; executar PM2 HML com inventario de rotas; padronizar prefixos; testar roles, ownership e IDOR; sanear logs/secrets. Gate: todos os endpoints criticos respondem no processo real e acessos cruzados falham.

### 22.3 - Banco, migrations e integridade

Criar ledger de migrations, reconciliar duplicidade de class links, auditar `information_schema`, FKs, indices, charset/timezone e idempotencia. Aplicar somente em HML com backup. Gate: schema reproduzivel e drift zero documentado.

### 22.4 - Admin e eliminacao de mocks

Conectar Configuracoes e Aula Experimental ou apresentar indisponibilidade explicita; remover seeds/fallbacks de producao; validar alunos, responsaveis, professores, turmas, matriculas, agenda e presenca no browser.

### 22.5 - Financeiro e integracoes HML

Executar cobranca Pix de baixo valor, webhook assinado, idempotencia, conciliacao, mensalidade, automacao n8n e historico. Testar timeouts/retries e rollback/reconciliacao.

### 22.6 - Portais self-service e Professor

Completar apenas lacunas funcionais aprovadas do Professor; validar aluno/responsavel multi-dependente, agenda, financeiro, documentos, notificacoes e presenca com ownership negativo.

### 22.7 - Infraestrutura, backup e observabilidade

Corrigir topologia TLS, health com dependencias, rotacao, metricas/alertas, backup automatico e restore testado. Documentar deploy/rollback reproduzivel.

### 22.8 - CI e E2E

Versionar pipeline com testes backend/frontend, contratos, lint, Client, SSR, secret scan e E2E dos 22 fluxos criticos. Impedir merge se composition root ou schema divergir.

### 22.9 - Homologacao formal

Executar matriz por perfil e dispositivo, carga minima, conciliacao financeira, relatorios/BI e aceite de negocio. Registrar evidencias, incidentes e criterios de go/no-go.

### 22.10 - Go-live controlado

Somente apos gates anteriores: janela, backup validado, rollback ensaiado, monitoramento ativo, responsaveis e smoke pos-deploy. Nao declarar go-live enquanto houver bloqueador critico/alto aberto.

## Criterio real para 100%

100% significa: fluxos aprovados implementados; mocks de producao eliminados; API do PM2 equivalente ao contrato; schema reproduzivel; testes E2E por role; integracoes reais homologadas; backup/restore ensaiados; observabilidade e CI ativos; aceite de negocio e go-live documentados. Nao significa apenas concluir numeracao de sprints.
