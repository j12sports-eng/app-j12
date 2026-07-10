# Checklist de Dry Run

Não registrar valores de credenciais, URLs resolvidas, dados pessoais ou payload financeiro real.

## Identificação

- Data/janela: __________
- Commit dos JSONs: __________
- Versão n8n: __________
- Workflow/cópia: __________
- Operador e aprovador: __________

## API e isolamento

- [ ] API stub disponível e health check aprovado.
- [ ] Sink de mensagens disponível e incapaz de realizar entrega.
- [ ] Egress para API J12, Banco Inter, BotConversa e WhatsApp reais bloqueado.
- [ ] Fixtures são sintéticas e não contêm dados pessoais.
- [ ] Nenhum destino real aparece na resolução dos nós.

## Credenciais e variáveis

- [ ] Credenciais de simulação configuradas no cofre.
- [ ] Credenciais não têm validade em sistemas reais.
- [ ] Variáveis da cópia apontam exclusivamente para stubs/sinks HML.
- [ ] Nenhum segredo foi copiado para workflow, log ou evidência.

## Workflows

- [ ] JSONs importados com `active=false`.
- [ ] Originais permanecem desativados e não foram executados.
- [ ] Cópia `DRY RUN` criada, inativa e sem gatilho automático.
- [ ] Os quatro nós HTTP de lembretes foram conferidos contra destinos stub.
- [ ] Quatro envelopes vazios marcados como Dry Run estrutural bloqueado.

## Execução manual

- [ ] Caso e resultado esperado registrados antes da execução.
- [ ] Somente a cópia isolada foi executada manualmente.
- [ ] Caminho e saída de cada nó foram conferidos.
- [ ] Caso repetido executado com chave sintética idêntica.
- [ ] Cenários de erro foram injetados apenas pelo stub.

## Logs e resultados

- [ ] IDs e horários de execução registrados.
- [ ] Logs sem segredo, URL real ou dado pessoal.
- [ ] Sink capturou requisição sem entregar mensagem.
- [ ] Stub registrou apenas efeitos simulados.
- [ ] Não houve retry infinito, duplicidade ou sucesso falso.
- [ ] Resultado confrontado com `DRY_RUN_EXPECTED_RESULTS.md`.

## Encerramento

- [ ] Execuções encerradas e todos os workflows inativos.
- [ ] Vínculos da cópia descartável removidos.
- [ ] Evidências anonimizadas preservadas.
- [ ] Incidentes e divergências registrados.
- [ ] Decisão final assinada.

Resultado: [ ] APROVADO  [ ] REPROVADO  [ ] BLOQUEADO

Observações: __________
