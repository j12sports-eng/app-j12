# Instalação dos Workflows n8n em HML

## Pré-requisitos

- instância n8n de homologação disponível;
- API J12 e provedores sandbox/HML acessíveis;
- variáveis configuradas conforme `WORKFLOW_VARIABLES.md`;
- credenciais provisionadas no cofre conforme `CREDENTIALS_TEMPLATE.md`;
- allowlist de destinatários e plano de rollback aprovados.

## Importação

Importar, sempre inativos, os cinco JSONs de `docs/N8N/workflows/` na ordem definida em `WORKFLOW_DEPENDENCIES.md`.

Depois da importação:

1. Conferir nomes, nós, conexões e timezone.
2. Vincular somente credenciais HML aos nós consumidores.
3. Executar manualmente os casos de `WORKFLOW_TEST_PLAN.md`.
4. Preencher `HML_CHECKLIST.md`.
5. Ativar somente workflow executável com aprovação técnica e financeira.

Quatro workflows são envelopes vazios no estado atual e devem permanecer inativos. Produção e integrações reais estão fora do escopo.
