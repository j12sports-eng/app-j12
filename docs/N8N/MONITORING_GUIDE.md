# Guia de Monitoramento das Automações n8n

## Objetivo e escopo

Definir observabilidade operacional para workflows financeiros sem implementar infraestrutura, ativar produção ou executar cobranças. Os limites e thresholds deste documento são valores iniciais para validação em HML.

## Arquitetura de monitoramento

Fluxo lógico esperado:

1. O n8n registra metadados da execução, duração, estado, workflow e erro.
2. Os workflows emitem eventos estruturados conforme `LOGGING_GUIDE.md`.
3. Um coletor autorizado recebe métricas e logs sem payload financeiro sensível.
4. O armazenamento de observabilidade aplica retenção, acesso mínimo e auditoria.
5. O dashboard consulta séries agregadas e estado corrente.
6. O mecanismo de alertas avalia `ALERT_POLICY.md` e encaminha incidentes.
7. O operador correlaciona alerta, dashboard, `executionId` e `correlationId`.

Esta arquitetura é documental. Nenhum coletor, dashboard ou canal de alerta foi provisionado nesta sprint.

## Métricas mínimas

| Métrica | Tipo | Dimensões permitidas | Finalidade |
| --- | --- | --- | --- |
| `workflow_execution_total` | contador | ambiente, workflow, status | volume e taxa de sucesso |
| `workflow_execution_duration_ms` | histograma | ambiente, workflow, status | média e percentis de duração |
| `workflow_active` | gauge | ambiente, workflow | detectar ativação indevida |
| `workflow_error_total` | contador | ambiente, workflow, classe | falhas por fluxo e severidade |
| `workflow_retry_total` | contador | ambiente, workflow, resultado | volume e eficácia de retries |
| `workflow_items_total` | contador | ambiente, workflow, resultado | processados, ignorados e falhos |
| `workflow_last_success_timestamp` | gauge | ambiente, workflow | recência da última execução aprovada |
| `dependency_health` | gauge | ambiente, dependência | disponibilidade de n8n, API e provedores permitidos |

Não usar aluno, telefone, e-mail, cobrança ou `eventKey` como label de métrica; alta cardinalidade e dados pessoais pertencem somente a logs restritos e minimizados.

## KPIs e fórmulas

| KPI | Fórmula | Janela inicial |
| --- | --- | --- |
| Taxa de sucesso | concluídas / execuções encerradas × 100 | 24 horas e 7 dias |
| Taxa de erro | falhas / execuções encerradas × 100 | 24 horas |
| Tempo médio | soma das durações / execuções encerradas | 24 horas |
| Duração p95 | percentil 95 da duração | 24 horas |
| Taxa de retry | tentativas de retry / execuções iniciadas × 100 | 24 horas |
| Recuperação por retry | retries concluídos / retries encerrados × 100 | 24 horas |
| Recência | agora − última execução bem-sucedida | conforme agenda do workflow |
| Duplicidade | efeitos adicionais para a mesma chave idempotente | por execução e dia |

Excluir execuções manuais de Dry Run dos KPIs operacionais ou identificá-las com dimensão `mode=dry_run`.

## Health checks

| Componente | Verificação | Resultado saudável |
| --- | --- | --- |
| n8n | processo, fila, banco interno e workers | painel disponível e fila sem crescimento anormal |
| workflow | importação, nós, conexões e estado | estrutura esperada; estado coerente com o ambiente |
| API J12 HML | endpoint de saúde autorizado | resposta no limite acordado e sem autenticação exposta |
| Stub/sink de Dry Run | health e captura | disponível e incapaz de atingir integração real |
| Credenciais | vínculo, escopo e expiração | válidas para HML, menor privilégio e rotação registrada |
| Observabilidade | ingestão e atualização | logs/métricas recentes sem atraso acima do acordado |

Health check nunca deve criar cobrança, baixa, mensagem ou mutação financeira.

## Rotina diária

### Início da janela

- conferir ambiente, workflows ativos e alterações desde o último turno;
- confirmar saúde do n8n, fila, coleta e dependências permitidas;
- revisar alertas abertos, credenciais próximas da expiração e última execução esperada.

### Durante a operação

- acompanhar taxa de sucesso, falhas, retries, duração p95 e volume;
- investigar anomalias por `executionId`, sem reexecutar antes de reconciliar;
- aplicar `ERROR_CLASSIFICATION.md` e `INCIDENT_RESPONSE.md`.

### Encerramento

- registrar execuções esperadas versus realizadas;
- reconciliar erros, retries e itens em estado desconhecido;
- confirmar ausência de duplicidade e retry pendente;
- documentar decisão, responsável e passagem de turno.

## Retenção e acesso

Definir retenção com segurança e financeiro antes da ativação. Logs devem ser acessíveis apenas a papéis autorizados, ter trilha de auditoria e ser anonimizados ao expirar. Métricas agregadas não devem permitir reconstruir dados pessoais ou financeiros.

## Gates de prontidão

- schema de logs validado em HML;
- métricas recebidas e fórmulas conferidas com fixtures;
- alertas testados sem canal produtivo;
- dashboard atualizado dentro da latência acordada;
- runbooks e responsáveis definidos;
- zero segredo, URL fixa ou dado pessoal desnecessário.
