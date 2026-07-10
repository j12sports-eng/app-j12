# Dependências e Ordem Oficial dos Workflows

## Premissas

- Dependência **documental** descreve a sequência operacional pretendida; não prova integração executável.
- Somente `financeiro-lembretes` possui nós no estado atual.
- Os outros quatro workflows estão bloqueados para ativação até possuírem fluxo e testes aprovados.

## Matriz de dependências

| Workflow | Gatilho pretendido | Dependências externas | Dependência entre workflows | Estado atual | Gate HML |
| --- | --- | --- | --- | --- | --- |
| `financeiro-baixa-pagamento` | confirmação de pagamento | API J12; Banco Inter quando a origem exigir; credencial de serviço | fornece estado de pagamento confiável aos fluxos de cobrança | zero nós/conexões | bloqueado |
| `financeiro-cobranca-vencimento` | agenda no dia do vencimento | API J12; provedor de mensagens | depende de estado financeiro atualizado pela baixa | zero nós/conexões | bloqueado |
| `financeiro-cobranca-diaria` | agenda diária | API J12; provedor de mensagens | depende de estado financeiro atualizado e precede reprocessamento | zero nós/conexões | bloqueado |
| `financeiro-lembretes` | agenda diária às 08:00 | API J12; BotConversa; `J12_API_URL`; `BOTCONVERSA_URL` | independente em execução, mas exige idempotência compartilhada na API | 12 nós/10 conexões | candidato a teste manual |
| `financeiro-reprocessar-falhas` | agenda/fila de falhas | API J12; provedores dos fluxos de origem; `RETRY_LIMIT` | depende dos eventos de falha dos demais | zero nós/conexões | bloqueado |

Não há chamada direta entre workflows comprovada nos JSONs atuais. As relações acima são operacionais e devem ser revalidadas quando os envelopes receberem implementação em sprint autorizada.

## Ordem oficial de importação

1. `financeiro-baixa-pagamento`
2. `financeiro-cobranca-vencimento`
3. `financeiro-cobranca-diaria`
4. `financeiro-lembretes`
5. `financeiro-reprocessar-falhas`

Todos devem entrar inativos. A importação dos envelopes serve apenas para validar compatibilidade estrutural.

## Ordem oficial de teste e ativação

1. Baixa de pagamento: comprovar autenticação, correlação e idempotência.
2. Cobrança no vencimento: comprovar seleção por data/status e efeito único.
3. Cobrança diária: comprovar paginação, volume e isolamento de falhas.
4. Lembretes: comprovar allowlist, envio sandbox, registro e idempotência.
5. Reprocessar falhas: somente após os produtores de falha; comprovar backoff e limite.

A ordem não supera os gates individuais. No estado atual, as etapas 1, 2, 3 e 5 estão bloqueadas; lembretes pode ser testado isoladamente, mas não ativado até aprovação completa do checklist.

## Dependências de credenciais

| Credencial | Baixa | Vencimento | Diária | Lembretes | Reprocessar |
| --- | ---: | ---: | ---: | ---: | ---: |
| API J12 | prevista | prevista | prevista | necessária | prevista |
| Banco Inter HML | condicional | não | não | não | condicional |
| BotConversa HML | não | prevista | prevista | necessária | condicional |
| WhatsApp Provider HML | não | condicional | condicional | não no JSON atual | condicional |

`Prevista` e `condicional` não autorizam vínculo antecipado. Vincular somente quando existir nó consumidor e teste específico.

## Condições de bloqueio global

- ambiente não identificado inequivocamente como HML;
- ausência de allowlist, backup, aprovadores ou plano de rollback;
- credencial sem proprietário/expiração ou variável apontando fora de HML;
- workflow vazio, nó desconhecido, conexão quebrada ou teste idempotente reprovado;
- indisponibilidade da API/provedor ou divergência de payload.
