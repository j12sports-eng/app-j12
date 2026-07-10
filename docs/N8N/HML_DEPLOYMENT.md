# Deploy dos Workflows n8n em HML

## Objetivo

Preparar o ambiente de homologação antes de qualquer ativação. Este guia não autoriza produção, cobrança real, baixa real nem envio a destinatários reais.

## Estado atual

- `financeiro-lembretes`: 12 nós, parametrizado e apto a avançar para teste manual em HML.
- `financeiro-baixa-pagamento`, `financeiro-cobranca-diaria`, `financeiro-cobranca-vencimento` e `financeiro-reprocessar-falhas`: envelopes sem nós/conexões; podem ser importados inativos, mas não ativados.
- Não há configuração executável do n8n versionada no repositório; a preparação ocorre no painel/cofre do ambiente.

## Responsabilidades

| Papel | Responsabilidade |
| --- | --- |
| Operador n8n | importar, vincular credenciais, executar testes e preservar evidências |
| Responsável da API J12 | confirmar endpoint HML, escopo e disponibilidade |
| Responsável financeiro | aprovar fixtures, efeitos e reconciliação |
| Responsável de segurança | provisionar, rotacionar e revogar credenciais |
| Aprovador da mudança | autorizar ativação e rollback |

## Pré-requisitos

- instância/projeto n8n identificado visualmente como HML;
- acesso por perfil de menor privilégio e auditoria habilitada;
- timezone `America/Sao_Paulo`;
- retenção de execuções definida sem exposição desnecessária de dados pessoais;
- egress limitado aos serviços HML aprovados;
- allowlist exclusiva de destinatários de teste;
- variáveis e credenciais provisionadas conforme `CREDENTIALS_TEMPLATE.md`;
- backup/export da versão anterior e plano `WORKFLOW_ROLLBACK.md` disponíveis;
- janela, operador e aprovadores registrados.

## Variáveis de ambiente

| Nome | Obrigatoriedade | Consumidor atual | Regra |
| --- | --- | --- | --- |
| `J12_API_URL` | obrigatória | lembretes | URL base HML, sem segredo e sem barra final |
| `BOTCONVERSA_URL` | obrigatória | lembretes | endpoint sandbox/HML, sem segredo na URL |
| `WHATSAPP_PROVIDER` | condicional | nenhum atualmente | identificador aprovado quando houver nó consumidor |
| `LOG_LEVEL` | operacional | nenhum atualmente | nível compatível com auditoria e minimização de dados |
| `RETRY_LIMIT` | obrigatória antes do reprocessador | nenhum atualmente | inteiro finito e baixo em HML |
| `BANCO_INTER_ENVIRONMENT` | condicional | nenhum atualmente | marcador de ambiente não produtivo |

Variáveis específicas do Banco Inter não devem carregar material secreto. Identificadores e certificados pertencem ao cofre de credenciais, não ao ambiente nem aos JSONs.

## Processo de deploy

1. Registrar commit, versão do n8n, janela, operador e aprovadores.
2. Confirmar que o painel é HML e que a allowlist bloqueia destinatários reais.
3. Provisionar variáveis sem incluir credenciais em valores de URL.
4. Criar as credenciais no cofre e validar proprietário, escopo, expiração e rotação.
5. Exportar qualquer versão existente antes de importar.
6. Importar os JSONs na ordem oficial de `WORKFLOW_DEPENDENCIES.md`, sempre com `active=false`.
7. Conferir nome, quantidade de nós, conexões, timezone e tipos de nós.
8. Vincular apenas as credenciais efetivamente consumidas.
9. Executar os casos de `WORKFLOW_TEST_PLAN.md` manualmente com fixtures sintéticas.
10. Repetir o mesmo evento para validar idempotência e anexar evidências.
11. Preencher `HML_CHECKLIST.md` e obter aprovações.
12. Ativar somente workflows com gate aprovado, um por vez, observando a primeira execução.

## Ativação controlada

- `financeiro-lembretes` pode ser candidato após teste integral aprovado.
- Workflows com zero nós ou conexões vazias têm gate automático **BLOQUEADO**.
- O reprocessador é sempre o último e exige limite finito, backoff e idempotência comprovados.
- Qualquer divergência de ambiente, destinatário ou credencial interrompe o processo.
- Ativação em produção está fora desta sprint.

## Monitoramento inicial

Durante a janela, acompanhar IDs de execução, respostas HTTP, volume, tempo, falhas e eventos registrados. Interromper em duplicidade, retry crescente, resposta de autenticação, payload incompatível ou envio fora da allowlist.

## Rollback

1. Desativar o workflow afetado; em risco de ambiente, desativar todos.
2. Impedir novos gatilhos e não acionar o reprocessador.
3. Preservar IDs, entradas anonimizadas, último nó e efeitos observados.
4. Revogar/rotacionar credenciais quando aplicável.
5. Reconciliar efeitos antes de repetir qualquer evento.
6. Restaurar a última exportação aprovada, inativa.
7. Executar caso sintético e teste idempotente antes de considerar retorno.

O procedimento detalhado está em `WORKFLOW_ROLLBACK.md` e o checklist em `HML_CHECKLIST.md`.

## Evidências mínimas

- checklist datado e assinado;
- commit e hash dos JSONs importados;
- versão do n8n e IDs dos workflows/execuções;
- resultados dos testes sem valores secretos;
- decisão de ativar, manter inativo ou executar rollback;
- registro de reconciliação quando houver efeito parcial.
