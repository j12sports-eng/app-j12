# Importação dos Workflows

## Pré-requisitos

- n8n instalado
- Credenciais configuradas
- Variáveis de ambiente configuradas

## Importação

1. Abrir o n8n.
2. Selecionar Import Workflow.
3. Importar cada JSON da pasta workflows.
4. Configurar as credenciais.
5. Salvar.
6. Executar manualmente.
7. Ativar após validação.

## Ordem sugerida

1. financeiro-baixa-pagamento
2. financeiro-cobranca-vencimento
3. financeiro-cobranca-diaria
4. financeiro-lembretes
5. financeiro-reprocessar-falhas

## Rollback

Desativar os workflows e restaurar a versão anterior pelo Git.
