# Resposta a Incidentes no Dry Run

## Princípios

Priorizar contenção, preservação de evidências e prevenção de efeitos adicionais. Não repetir execução até reconciliar o estado. Nunca inserir credenciais ou dados pessoais no registro do incidente.

## Ações imediatas comuns

1. Parar a execução e manter original/cópia inativos.
2. Bloquear egress e novos gatilhos.
3. Registrar horário, workflow, ID da execução, último nó e operador.
4. Preservar entradas/saídas anonimizadas e resposta do stub.
5. Verificar se ocorreu chamada fora do ambiente isolado.
6. Classificar impacto e notificar responsáveis técnico, segurança e financeiro.

## Falha da API stub

- confirmar health check, rota e fixture sem trocar para API real;
- manter execução bloqueada;
- corrigir somente o ambiente de simulação e repetir após aprovação;
- se houve destino real, elevar a incidente crítico.

## Timeout

- interromper novas tentativas e verificar execuções pendentes;
- distinguir timeout do stub de efeito confirmado; timeout não prova ausência de efeito;
- revisar limite e resposta simulada, sem aumentar indiscriminadamente;
- reconciliar capturas antes de repetir.

## Erro de autenticação

- não contornar autenticação nem reutilizar credencial real;
- confirmar vínculo da credencial exclusiva de simulação;
- verificar escopo/expiração sem expor valores;
- repetir somente contra stub após correção e registro.

## Credencial inválida ou exposta

- remover o vínculo e revogar/rotacionar no cofre;
- revisar logs/evidências e restringir acesso;
- invalidar a execução como evidência de aprovação;
- abrir incidente de segurança se a credencial tiver validade real.

## Payload inválido

- interromper o caso sem retry automático;
- preservar payload sintético e erro de validação;
- comparar com a fixture/contrato esperado;
- corrigir a fixture/configuração do Dry Run, nunca regra financeira nesta sprint.

## Duplicidade

- parar execução e bloquear reprocessamento;
- correlacionar pela chave sintética e IDs de execução;
- contar capturas e registros simulados;
- reprovar o caso até provar efeito único e idempotência.

## Chamada ou efeito real

É incidente crítico:

1. Desativar todos os workflows e bloquear egress.
2. Revogar credenciais envolvidas.
3. Preservar evidências e identificar destinatários/efeitos.
4. Acionar responsáveis de segurança, integração e financeiro.
5. Reconciliar antes de qualquer compensação ou repetição.
6. Não retomar o Dry Run até análise e nova autorização formal.

## Rollback

1. Cancelar execuções seguras de cancelar e impedir novas.
2. Manter o JSON original inativo e intocado.
3. Remover credenciais/variáveis da cópia de Dry Run.
4. Restaurar a cópia/versão anterior somente se necessária para investigação.
5. Aplicar a reconciliação de `WORKFLOW_ROLLBACK.md`.
6. Executar novamente apenas após correção do isolamento e aprovação.

## Encerramento

O incidente encerra quando não há execução pendente, destinos reais estão bloqueados, credenciais foram tratadas, efeitos reconciliados, causa/impacto documentados e responsáveis aprovaram a decisão. Dry Run reprovado não pode ser convertido em aprovação parcial.
