# Dashboard Operacional n8n

## Objetivo

Especificar um painel de operação para HML. Esta sprint não implementa dashboard nem conecta fontes reais.

## Filtros globais

- ambiente;
- período;
- workflow;
- modo (`DRY_RUN`, `MANUAL`, `SCHEDULED`);
- status e classe de erro.

O ambiente deve permanecer visível e sem seleção implícita de produção.

## Indicadores principais

| Indicador | Cálculo/estado | Apresentação |
| --- | --- | --- |
| Workflows ativos | soma de `workflow_active=1` | total e lista; em HML deve corresponder às autorizações |
| Workflows com erro | workflows com ao menos uma falha não resolvida na janela | total, nome, classe e última ocorrência |
| Retries | total por resultado e tentativa | volume, taxa e esgotados |
| Tempo médio | média de `workflow_execution_duration_ms` | valor e comparação com linha de base |
| Duração p95 | percentil 95 por workflow | série temporal |
| Falhas por workflow | contagem por workflow/classe | barras e tendência |
| Taxa de sucesso | concluídas / encerradas × 100 | percentual com volume da amostra |
| Último sucesso | timestamp por workflow | idade e atraso versus agenda |

Workflows vazios devem aparecer como `BLOQUEADO`, não como saudáveis por ausência de erro.

## Painéis

### Visão geral

- estado do n8n/coleta;
- ativos, falhando, bloqueados e sem execução;
- taxa de sucesso, erros, retries e duração p95;
- alertas abertos por severidade.

### Por workflow

- estado/configuração atual;
- volume e sucesso por janela;
- duração média/p95;
- última execução/sucesso;
- falhas por classe e dependência;
- retries e itens ignorados.

### Dependências

- saúde e latência de API J12, stubs e provedores permitidos;
- falhas e timeouts por dependência;
- credenciais próximas da expiração, sem exibir valores.

### Incidentes

- alertas abertos, reconhecidos e resolvidos;
- responsável, idade e severidade;
- `executionId`/`correlationId` sanitizados para investigação;
- link interno ao runbook configurado na plataforma.

## Estados visuais

| Estado | Significado |
| --- | --- |
| Saudável | execução esperada e KPIs dentro da linha de base |
| Atenção | degradação ou alerta de atenção em investigação |
| Crítico | impacto/risco exige contenção imediata |
| Bloqueado | workflow vazio, gate pendente ou ativação proibida |
| Sem dados | coleta ausente; nunca interpretar como saudável |

Cor nunca deve ser o único sinal; exibir texto, ícone e timestamp.

## Atualização e qualidade

- exibir horário da última atualização e atraso de ingestão;
- separar dados de Dry Run dos operacionais;
- mostrar denominador junto a percentuais;
- marcar períodos sem dados e mudanças de versão;
- impedir alta cardinalidade e dados pessoais em filtros;
- validar totais do dashboard contra execuções n8n amostradas.

## Thresholds iniciais

Usar os limites de `ALERT_POLICY.md` apenas como baseline HML. Toda alteração deve registrar data, justificativa e aprovador. Baixo volume não deve gerar percentual enganoso; aplicar amostra mínima definida.

## Estado atual esperado

Enquanto os JSONs entregues permanecerem inativos, o indicador de workflows ativos deve ser zero. `financeiro-lembretes` é candidato a testes controlados; os outros quatro devem constar como bloqueados por ausência de nós/conexões.

## Critérios de aceite futuro

- dados atualizam dentro da latência acordada;
- fórmulas conferem com fixtures e amostras do n8n;
- alertas abrem e resolvem conforme política;
- IDs permitem navegar da métrica ao log e à execução;
- nenhum segredo, URL fixa ou dado pessoal é exibido;
- acesso e retenção são auditáveis.
