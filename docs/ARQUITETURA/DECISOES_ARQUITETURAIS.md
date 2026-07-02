# Decisoes Arquiteturais - Sprint 9.0.5

Registro das decisoes conceituais aprovadas para a arquitetura de contratos.

## 1. Dominio Contracts Unico

Decisao:

- Criar arquitetura alvo de dominio `contracts/` para todos os tipos de
  contrato.

Motivo:

- Evita contratos separados e inconsistentes por modulo.
- Permite ciclo de vida, assinatura, rescisao e auditoria padronizados.

## 2. Contract e Raiz, Version e Imutavel

Decisao:

- `Contract` guarda identidade e status atual.
- `ContractVersion` guarda conteudo e snapshots imutaveis.

Motivo:

- Contratos assinados nao podem ser reescritos.
- Alteracoes precisam de historico completo.

## 3. Renovacao Pode Ser Nova Versao ou Novo Contrato

Decisao:

- Continuidade do mesmo acordo gera nova versao.
- Nova relacao juridica gera novo contrato.

Motivo:

- Preserva historico sem misturar relacoes diferentes.

## 4. Rescisao e Entidade Propria

Decisao:

- Rescisao deve usar `ContractTermination`.

Motivo:

- Cancelamento simples nao cobre multa, proporcional, aviso previo, aprovacao,
  anexos e baixa financeira.

## 5. Assinatura Aponta para Versao

Decisao:

- `ContractSignature` deve apontar para `ContractVersion`.

Motivo:

- A assinatura comprova aceite de um texto especifico.

## 6. Historico e Obrigatorio

Decisao:

- Todo evento relevante gera `ContractHistory`.

Motivo:

- Auditoria, LGPD, suporte, financeiro e juridico dependem de trilha completa.

## 7. Documentos Sao Dominio Transversal

Decisao:

- Documentos podem pertencer a Person, Profile ou Contract.

Motivo:

- RG e CPF sao da pessoa; certificacao e do perfil; distrato e anexo sao do
  contrato.

## 8. Financeiro Deriva de Contrato, Mas Nao Mora Nele

Decisao:

- Contrato gera ou referencia `PaymentPlan`; cobrancas e baixas ficam no
  financeiro.

Motivo:

- Separa acordo juridico de execucao financeira.

## 9. Compatibilidade com Legado

Decisao:

- Fluxo atual de contratos de aluno deve ser preservado durante migracao.

Motivo:

- O sistema esta em uso e nao pode perder funcionalidade.

## 10. Banco Atual

Decisao:

- A documentacao considera MySQL como banco atual do repositorio, conforme docs
  existentes, ate decisao formal diferente.

Motivo:

- Evita desenhar implementacao baseada em ferramenta ausente.

## Pendencias para Sprint 9.1+

- Confirmar nomes fisicos de tabelas.
- Confirmar padrao de IDs.
- Confirmar provedor inicial de assinatura.
- Confirmar regras juridicas por tipo de contrato.
- Confirmar politica de retencao LGPD.
- Confirmar regras financeiras de multa/reembolso por tipo.
- Confirmar se funcionarios/prestadores entram como perfis de Pessoa ou
  subtipos mais especializados.

