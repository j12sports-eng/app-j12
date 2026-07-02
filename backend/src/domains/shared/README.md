# Dominio Shared

Estrutura reservada para recursos compartilhados entre dominios.

## Objetivo futuro

Concentrar contratos, tipos e utilitarios realmente compartilhados por dominios, sem regra especifica de negocio.

## Estrutura

- `controllers/`: reservado apenas se houver controladores compartilhados e explicitamente aprovados.
- `services/`: futuros services compartilhados sem regra de dominio especifica.
- `repositories/`: futuros repositories compartilhados apenas quando houver justificativa arquitetural.
- `validators/`: validadores compartilhados.
- `types/`: tipos compartilhados entre dominios.

## Estado atual

Nenhum modulo existente foi migrado nesta Sprint. Preferir `backend/src/core` para infraestrutura transversal.
