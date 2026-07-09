# Sprint 20.4 - Validação Operacional n8n

## Objetivo e limites

Preparar a importação controlada dos workflows financeiros no n8n de homologação, sem executar cobrança real, ativar produção ou alterar backend, frontend, banco de dados ou API. A importação e os testes no painel permanecem ações manuais de homologação.

## Revisão estrutural

| Workflow | `name` | Nós | Conexões | `active` | `settings` | `meta` | Situação operacional |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| `financeiro-lembretes.json` | válido | 12 | preenchidas | `false` | válido | válido | apto para importação e teste manual controlado |
| `financeiro-baixa-pagamento.json` | válido | 0 | vazias | `false` | válido | válido | não ativar; envelope sem fluxo executável |
| `financeiro-cobranca-diaria.json` | válido | 0 | vazias | `false` | válido | válido | não ativar; envelope sem fluxo executável |
| `financeiro-cobranca-vencimento.json` | válido | 0 | vazias | `false` | válido | válido | não ativar; envelope sem fluxo executável |
| `financeiro-reprocessar-falhas.json` | válido | 0 | vazias | `false` | válido | válido | não ativar; envelope sem fluxo executável |

Todos possuem a estrutura mínima solicitada e permanecem inativos. Estrutura mínima não comprova comportamento operacional.

## Ambiente de homologação

### Variáveis obrigatórias

| Variável | Uso e validação |
| --- | --- |
| `J12_API_URL` | Base exclusiva da API de homologação, sem credencial na URL |
| `BOTCONVERSA_URL` | Endpoint sandbox/homologação, com destinatários restritos |
| `WHATSAPP_PROVIDER` | Identificador do provedor homologado |
| `LOG_LEVEL` | Diagnóstico sem segredos ou dados pessoais desnecessários |
| `RETRY_LIMIT` | Inteiro finito e inicialmente baixo |

No estado atual, `financeiro-lembretes` referencia diretamente `J12_API_URL` e `BOTCONVERSA_URL`. As demais variáveis devem ser reconfirmadas quando os quatro envelopes receberem nós executáveis.

### Credenciais obrigatórias

- `J12 Automation Service Token`: API J12 de homologação.
- `BotConversa API Token`: sandbox/homologação do provedor.
- `WhatsApp Provider Credential`: somente quando houver nó que a utilize.

Criar no cofre do n8n, com menor privilégio, nome identificando `HML`, rotação definida e sem valores no JSON.

### Critérios para ativar

- painel confirmado como homologação e backup da versão importada armazenado;
- JSON importado sem erro, todos os nós reconhecidos e fluxo executável;
- variáveis resolvidas, credenciais HML vinculadas e allowlist configurada;
- plano em `WORKFLOW_TEST_PLAN.md`, execução manual e idempotência aprovados;
- aprovação dos responsáveis técnico e financeiro.

### Critérios para desativar

- ambiente, credencial ou URL diverge de homologação;
- destinatário fora da allowlist, duplicidade, volume ou repetição inesperada;
- resposta 401/403, indisponibilidade persistente ou payload incompatível;
- falha ao registrar o resultado na API J12;
- workflow sem nós/conexões ou sem evidência de teste.

### Como simular execução

1. Manter inativo e desabilitar o gatilho agendado durante a preparação.
2. Confirmar variáveis e credenciais HML sem expor valores em capturas.
3. Preparar dados sintéticos e destinatário da allowlist.
4. Executar manualmente um único caso no painel.
5. Inspecionar cada nó, códigos HTTP, `executionId` e evento registrado.
6. Repetir o caso para comprovar idempotência.
7. Anonimizar ou remover dados de teste conforme a política do ambiente.

Para os quatro envelopes vazios, a simulação limita-se à importação estrutural; não há comportamento a executar.

## Checklist operacional

### Preparação e importação

- [ ] Confirmar projeto e versão n8n de homologação.
- [ ] Registrar responsável, janela, versão Git e rollback.
- [ ] Configurar as cinco variáveis, credenciais HML, allowlist e dados sintéticos.
- [ ] Exportar a versão anterior, se existir.
- [ ] Importar, sempre inativos: baixa, vencimento, diária, lembretes e reprocessamento.
- [ ] Conferir nome, nós, conexões, timezone, credenciais e variáveis.

### Ordem de ativação

1. Baixa de pagamento, quando possuir fluxo e testes aprovados.
2. Cobrança no vencimento, quando possuir fluxo e testes aprovados.
3. Cobrança diária, quando possuir fluxo e testes aprovados.
4. Lembretes, após teste manual e idempotente aprovado.
5. Reprocessar falhas, por último e com retry finito comprovado.

Ativar um por vez e observar ao menos uma execução antes do próximo. Atualmente, somente lembretes pode avançar ao teste manual; nenhum está autorizado para produção.

### Validação manual e rollback

- [ ] Executar casos feliz, vazio, inválido, indisponível e repetido.
- [ ] Confirmar que logs não expõem segredos e efeitos ocorrem somente em HML.
- [ ] Anexar evidências e obter aprovação.
- [ ] Em falha, desativar, avaliar execuções em curso e revogar credencial se necessário.
- [ ] Reconciliar efeitos/duplicidades antes de reprocessar.
- [ ] Restaurar conforme `WORKFLOW_ROLLBACK.md` e registrar o incidente.

## Matriz de riscos

| Risco | Prob. | Impacto | Prevenção/detecção | Resposta |
| --- | --- | --- | --- | --- |
| Falha na API J12 | média | alto | timeout, monitorar 5xx | desativar dependentes e retomar após health check |
| Falha no WhatsApp | média | alto | sandbox, status e timeout | suspender; não marcar sucesso; reprocessar com idempotência |
| Credencial ausente | média | alto | checklist e teste de conexão | manter inativo e corrigir no cofre |
| Payload inválido | média | alto | fixture e validação de campos | não fazer retry cego; registrar e corrigir |
| Duplicidade | baixa/média | crítico | `eventKey` e teste repetido | desativar e reconciliar efeitos |
| Retry infinito | baixa | alto | limite finito, backoff e alerta | desativar reprocessador e cancelar novas tentativas |
| Ambiente errado | baixa | crítico | nomes HML, banner, allowlist e dupla aprovação | desativar todos, revogar credenciais e abrir incidente |

## Riscos e conclusão

- Quatro arquivos não contêm nós nem conexões executáveis.
- Não houve acesso ao painel n8n; importação e compatibilidade runtime não foram comprovadas.
- Não houve chamada à API J12 ou WhatsApp, conforme o fora de escopo.
- A idempotência de lembretes depende da resposta da API e requer teste integrado controlado.

A validação operacional é **parcial**: os cinco JSONs atendem à estrutura mínima e parametrização, mas somente `financeiro-lembretes` está preparado para teste manual. Os demais devem permanecer inativos até possuírem fluxo executável e testes aprovados.
