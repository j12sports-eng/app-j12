# Dominio Financeiro

Estrutura reservada para a futura migracao do dominio financeiro.

## Objetivo futuro

Centralizar cobrancas, mensalidades, pagamentos, despesas, Pix e integracoes financeiras.

## Estrutura

- `controllers/`: futuros controllers do dominio.
- `services/`: futuros services do dominio.
- `repositories/`: futuros repositories do dominio.
- `validators/`: futuros validadores do dominio.
- `types/`: futuros tipos e contratos do dominio.

## Estado atual

Os fluxos financeiros operacionais continuam no modulo legado e permanecem
intactos.

As Sprints 12.3 e 12.4 adicionaram somente a camada application read-only para
preparar o contrato de plano, valor e vencimento e a obrigacao financeira
inicial de uma Matricula `ACTIVE`, sem criar cobranca, mensalidade, pagamento,
rota publica, migration ou escrita em banco.
