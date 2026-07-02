# Cadastro V2 - Checklist de Aprovacao

Este checklist valida se o contrato da Sprint 9.0 esta pronto para virar
implementacao na Sprint 9.1.

## Contrato HTTP

- [x] Metodo HTTP definido: `POST`.
- [x] URL definida: `/api/v2/cadastros`.
- [x] Coexistencia com endpoints atuais durante migracao definida.
- [x] Proibicao de quebrar rotas atuais durante Sprint 9.1 documentada.
- [x] `Content-Type` definido: `application/json`.
- [x] Headers obrigatorios definidos.
- [x] Headers recomendados definidos.
- [x] Autenticacao definida.
- [x] Permissao minima definida: `cadastros:criar`.
- [x] Variante publica declarada fora do escopo.

## Payload

- [x] Payload raiz definido.
- [x] Secao `origem` definida.
- [x] Secao `aluno` definida.
- [x] Secao `responsaveis[]` definida.
- [x] Secao `relacionamento` definida por responsavel.
- [x] Secao `matricula` definida.
- [x] Secao `documentos` definida.
- [x] Secao `metadata` definida.
- [x] Campos ausentes no exemplo inicial foram documentados.
- [x] Justificativa de cada campo adicional foi registrada.

## Regras de negocio

- [x] Nome do aluno obrigatorio.
- [x] Nome do responsavel obrigatorio.
- [x] CPF do aluno definido como opcional.
- [x] CPF do responsavel definido como condicional.
- [x] Data de nascimento obrigatoria.
- [x] Sexo do aluno obrigatorio.
- [x] Aluno pode possuir varios responsaveis.
- [x] `responsaveis[]` permite multiplos responsaveis desde o primeiro release.
- [x] Responsavel pode ser legal.
- [x] Responsavel pode ser financeiro.
- [x] Responsavel financeiro principal foi definido.
- [x] Responsavel pode receber comunicados.
- [x] Responsavel pode buscar aluno.
- [x] Responsavel pode ser contato de emergencia.
- [x] Contato de emergencia principal foi definido.
- [x] Reutilizacao de responsavel para irmaos foi definida.
- [x] Reutilizacao por `personId` foi definida.
- [x] Reutilizacao por CPF normalizado foi definida.
- [x] Duplicidade de relacionamento foi bloqueada.
- [x] Criterio de relacionamento duplicado foi definido.
- [x] Idempotencia foi definida.
- [x] Comportamento de timeout e clique duplo foi definido.
- [x] Operacoes fora do escopo foram listadas.

## Validacoes

- [x] Campos obrigatorios definidos.
- [x] Campos opcionais definidos.
- [x] Campos condicionais definidos.
- [x] Tipos definidos.
- [x] Tamanhos maximos definidos.
- [x] Formatos definidos.
- [x] Enumeracoes definidas.
- [x] Regra para enums ASCII definida.
- [x] Validacao de CPF definida.
- [x] Validacao de telefone definida.
- [x] Validacao de data definida.
- [x] Validacao de relacionamento definida.
- [x] Validacao de IDs externos definida.

## Fluxo

- [x] Fluxo macro documentado.
- [x] Fluxo de autenticacao documentado.
- [x] Fluxo de permissao documentado.
- [x] Fluxo de idempotencia documentado.
- [x] Fluxo de validacao documentado.
- [x] Fluxo de normalizacao documentado.
- [x] Fluxo de criacao/reuso de `Person` documentado.
- [x] Fluxo de criacao/reuso de `Profile` documentado.
- [x] Fluxo de criacao de `Relationship` documentado.
- [x] Fluxo de criacao de `Enrollment` documentado.
- [x] Fluxo de resposta documentado.

## Transacao

- [x] Transacao unica definida.
- [x] Cadeia `Person -> Profile -> Relationship -> Enrollment` definida como
      transacional.
- [x] Ordem de escrita definida.
- [x] `COMMIT` definido.
- [x] `ROLLBACK` definido.
- [x] Garantia contra dados parciais definida.
- [x] Concorrencia por CPF considerada.
- [x] Concorrencia por numero de matricula considerada.
- [x] Concorrencia por relacionamento duplicado considerada.
- [x] Concorrencia por idempotencia considerada.

## Respostas

- [x] `201 Created` documentado.
- [x] `400 Validation Error` documentado.
- [x] `401 Unauthorized` documentado.
- [x] `403 Forbidden` documentado.
- [x] `404 Not Found` documentado.
- [x] `409 Conflict` documentado.
- [x] `422 Unprocessable Entity` documentado.
- [x] `500 Internal Server Error` documentado.
- [x] Envelope padrao definido.
- [x] `requestId` definido.
- [x] `timestamp` definido.
- [x] `details[]` definido para erros.
- [x] Formato de erro unico para `/api/v2/*` definido.
- [x] Rotas legadas preservadas ate migracao propria.

## Casos de uso

- [x] Aluno com apenas mae.
- [x] Aluno com mae e pai.
- [x] Aluno com avo responsavel financeira.
- [x] Dois irmaos compartilhando o mesmo responsavel.
- [x] Responsavel ja existente.
- [x] Aluno sem CPF.
- [x] Responsavel sem CPF permitido.

## Casos de erro

- [x] CPF duplicado.
- [x] CPF conflitante.
- [x] Relacionamento duplicado.
- [x] Telefone invalido.
- [x] Data invalida.
- [x] Campos obrigatorios ausentes.
- [x] Permissoes inconsistentes.
- [x] Responsavel financeiro principal duplicado.
- [x] Contato de emergencia principal duplicado.
- [x] Responsavel legal/financeiro sem CPF.
- [x] ID externo inexistente.
- [x] Idempotency-Key reutilizada com payload diferente.
- [x] Erro interno.

## Frontend

- [x] Frontend consegue montar payload para um responsavel.
- [x] Frontend consegue montar payload para multiplos responsaveis.
- [x] Frontend atual pode migrar enviando `responsaveis[]` com um item.
- [x] Frontend consegue enviar aluno sem CPF.
- [x] Frontend consegue reutilizar responsavel por `personId`.
- [x] Frontend consegue reutilizar responsavel por CPF existente.
- [x] Frontend consegue tratar `201`.
- [x] Frontend consegue tratar `400`, `409` e `422` com `details[]`.
- [x] Frontend consegue mostrar mensagens por campo.
- [x] Frontend consegue guardar IDs retornados.
- [x] Contrato evita alteracoes de payload durante a implementacao da Sprint
      9.1.

## Backend

- [x] Backend consegue implementar validator a partir do contrato.
- [x] Backend consegue implementar service transacional a partir do fluxo.
- [x] Backend consegue mapear payload para `Person`.
- [x] Backend consegue mapear payload para `Profile`.
- [x] Backend consegue mapear payload para `Relationship`.
- [x] Backend consegue mapear payload para `Enrollment`.
- [x] Backend tem codigos de erro definidos.
- [x] Backend tem regra de idempotencia definida.
- [x] Backend tem limites e enums definidos.

## Banco de Dados

- [x] Banco precisa suportar identidade `Person`.
- [x] Banco precisa suportar `Profile` de aluno.
- [x] Banco precisa suportar `Profile` de responsavel.
- [x] Banco precisa suportar relacionamento aluno-responsavel.
- [x] Banco precisa suportar matricula.
- [x] Banco precisa suportar unicidade de CPF quando informado.
- [x] Banco precisa suportar unicidade de relacionamento ativo.
- [x] Banco precisa suportar responsavel financeiro principal unico por aluno.
- [x] Banco precisa suportar contato de emergencia principal unico por aluno.
- [x] Banco precisa suportar idempotencia ou mecanismo equivalente.
- [x] Banco precisa suportar auditoria minima de origem e metadata.

## Restricoes da Sprint 9.0

- [x] Nenhum codigo backend criado.
- [x] Nenhum codigo frontend criado.
- [x] Nenhum endpoint criado.
- [x] Nenhuma rota criada.
- [x] Nenhum controller criado.
- [x] Nenhum service criado.
- [x] Nenhum repository criado.
- [x] Nenhuma migration criada.
- [x] Nenhum teste criado.
- [x] Nenhum banco alterado.

## Pendencias para Sprint 9.1 antes de codar

- [ ] Confirmar nome fisico das tabelas finais.
- [ ] Confirmar motor de banco ativo para a implementacao.
- [ ] Confirmar padrao final de IDs.
- [ ] Confirmar se `matricula.statusInicial=ATIVA` sera permitido no primeiro
      release ou se todo cadastro nasce `PENDENTE`.
- [ ] Confirmar se criacao de contrato/financeiro seguira em endpoint separado.
- [ ] Confirmar regra operacional para aluno maior de idade sem responsavel.
- [ ] Confirmar limite maximo de responsaveis por aluno.
- [ ] Confirmar labels finais exibidos no frontend para enums ASCII.
