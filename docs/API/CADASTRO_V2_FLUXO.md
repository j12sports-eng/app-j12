# Cadastro V2 - Fluxo de Execucao e Transacao

Este documento descreve o fluxo operacional esperado para a Sprint 9.1. Ele nao
implementa codigo.

## Diagrama textual da arquitetura

```text
Frontend
->
API POST /api/v2/cadastros
->
Auth Middleware
->
Permission Middleware
->
Validator
->
CadastroV2 Service
->
Transaction
->
Person
->
Profile
->
Relationship
->
Enrollment
->
Response
```

## Fluxo macro

```text
1. Receber Request
2. Validar autenticacao
3. Validar permissao
4. Validar Content-Type
5. Validar Idempotency-Key
6. Validar schema JSON
7. Normalizar dados
8. Validar regras de negocio
9. Abrir transacao
10. Criar ou reutilizar Person do aluno
11. Criar ou reutilizar Profile de aluno
12. Criar ou reutilizar Person de cada responsavel
13. Criar ou reutilizar Profile de cada responsavel
14. Criar Relationship de cada vinculo
15. Criar Enrollment/Matricula
16. Registrar snapshots/metadados de compatibilidade
17. Confirmar transacao
18. Retornar IDs
```

## 1. Receber Request

Entrada esperada:

- Metodo `POST`.
- URL `/api/v2/cadastros`.
- Body JSON.
- Header `Authorization`.
- Header `Content-Type: application/json`.
- Header recomendado `Idempotency-Key`.
- Header recomendado `X-Request-Id`.

Falhas possiveis:

- JSON malformado: `400 VALIDATION_ERROR`.
- Content-Type invalido: `400 VALIDATION_ERROR`.
- Token ausente: `401 AUTH_REQUIRED`.

## 2. Validar autenticacao

O middleware de autenticacao deve:

- Ler `Authorization: Bearer <token>`.
- Validar assinatura e expiracao.
- Resolver usuario autenticado.
- Rejeitar token ausente ou invalido.

Falha:

```text
401 AUTH_REQUIRED
```

## 3. Validar permissao

O middleware de permissao deve:

- Exigir permissao `cadastros:criar`.
- Aceitar perfis administrativos aprovados, como `admin` ou `coordenador`.
- Bloquear usuario autenticado sem permissao.

Falha:

```text
403 FORBIDDEN
```

## 4. Validar idempotencia

Quando `Idempotency-Key` for enviado:

```text
Consultar chave
->
Se nao existe, reservar chave com hash do payload
->
Se existe com mesmo hash e concluida, retornar resposta anterior
->
Se existe com mesmo hash e em andamento, bloquear ou aguardar conforme decisao tecnica
->
Se existe com hash diferente, retornar 409
```

Regras:

- A chave deve ser unica por usuario, canal e endpoint.
- O hash deve considerar o payload normalizado.
- A resposta armazenada nao deve conter dados sensiveis alem do contrato.
- Timeout, retry automatico ou clique duplo devem usar a mesma chave gerada
  pelo frontend para a tentativa original.
- Mesma chave com mesmo payload concluido retorna o mesmo `201` logico com os
  mesmos IDs, sem executar nova escrita.
- Mesma chave com payload diferente retorna `409 CONFLICT`.
- Mesma chave com requisicao ainda em andamento retorna `409 CONFLICT` com
  `code=IDEMPOTENCY_IN_PROGRESS`, salvo se a implementacao optar por aguardar a
  conclusao de forma segura e documentada.

Falha:

```text
409 CONFLICT
```

## 5. Validar schema

O validador deve confirmar:

- `aluno` e objeto.
- `responsaveis` e array com ao menos 1 item.
- `matricula` e objeto.
- Tipos primitivos corretos.
- Campos obrigatorios presentes.
- Enums validos.
- Datas no formato `YYYY-MM-DD`.
- CPF e telefone em formato aceitavel.

Falha:

```text
400 VALIDATION_ERROR
```

## 6. Normalizar dados

Normalizacoes esperadas:

- Remover mascara de CPF.
- Remover caracteres nao numericos de telefone e WhatsApp.
- Converter email para lowercase.
- Remover espacos extras de nomes.
- Converter enums para formato canonico.
- Converter UF para uppercase.
- Tratar strings vazias como `null` quando o campo for opcional.
- Remover duplicidades em arrays de IDs.

Exemplo:

```text
"123.456.789-09" -> "12345678909"
"(11) 99999-8888" -> "11999998888"
"  Maria  Silva " -> "Maria Silva"
```

## 7. Validar regras de negocio

Validacoes de negocio antes da transacao:

- Aluno menor tem responsavel legal.
- Aluno ativo tem contato de emergencia.
- Responsavel legal/financeiro possui CPF.
- `financeiroPrincipal=true` implica `financeiro=true`.
- `emergenciaPrincipal=true` implica `emergencia=true`.
- Apenas um financeiro principal no payload.
- Apenas um contato de emergencia principal no payload.
- Pelo menos um canal de contato existe para quem recebe comunicados.
- Datas de vigencia sao coerentes.
- IDs informados existem e estao ativos.

Falhas:

```text
404 NOT_FOUND
409 CONFLICT
422 BUSINESS_RULE_ERROR
```

## 8. Abrir transacao

Toda escrita deve ocorrer dentro da mesma transacao.

```text
BEGIN
```

Requisitos:

- Nenhuma entidade parcial pode ficar persistida se qualquer etapa falhar.
- Locks devem proteger unicidade de CPF, numero de matricula e
  relacionamentos ativos.
- A reserva de numero de matricula deve ser confirmada apenas no `COMMIT`.
- A unidade transacional obrigatoria cobre `Person -> Profile -> Relationship
  -> Enrollment`.
- Falha em qualquer etapa deve executar `ROLLBACK` completo, inclusive quando a
  falha ocorrer apos criar ou reutilizar responsaveis.

## 9. Criar ou reutilizar Person do aluno

Ordem de resolucao:

```text
Se aluno.personId informado:
  buscar Person por ID
  validar compatibilidade
Senao se aluno.cpf informado:
  buscar Person ativa por CPF
  reutilizar se compativel
Senao:
  criar Person com nome, dataNascimento e dados disponiveis
```

Saidas:

- `personAlunoId`.
- Indicador se foi criado ou reutilizado.

Reuso obrigatorio:

- `personId` valido e compativel deve ser reutilizado.
- CPF valido encontrado em `Person` ativa compativel deve ser reutilizado.
- `personId` e CPF conflitantes devem bloquear o cadastro com `409 CONFLICT`.

Falhas:

- `404 NOT_FOUND` se `personId` nao existir.
- `409 CONFLICT` se CPF existir com dados conflitantes.
- `422 BUSINESS_RULE_ERROR` se dados nao forem suficientes.

## 10. Criar ou reutilizar Profile de aluno

Regras:

- Garantir um `Profile` do tipo `aluno`.
- Reutilizar profile ativo quando permitido.
- Criar novo profile se nao existir.
- Nao criar dois profiles ativos do mesmo tipo para a mesma pessoa sem decisao
  explicita de historico versionado.

Saidas:

- `profileAlunoId`.

## 11. Criar ou reutilizar Person dos responsaveis

Para cada item em `responsaveis[]`:

```text
Se responsavel.personId informado:
  buscar Person por ID
  validar compatibilidade
Senao se responsavel.cpf informado:
  buscar Person ativa por CPF
  reutilizar se compativel
Senao:
  criar Person apenas se regra permitir responsavel sem CPF
```

Saidas por responsavel:

- `personResponsavelId`.
- Indicador se foi criado ou reutilizado.

Reuso obrigatorio:

- Responsavel com `personId` valido e compativel deve reutilizar a pessoa
  existente.
- Responsavel sem `personId`, mas com CPF valido ja cadastrado, deve reutilizar
  a `Person` existente quando os dados forem compativeis.
- Responsavel legal ou financeiro sem CPF nao pode ser criado.
- Responsavel sem CPF so pode ser criado para busca, emergencia ou outro papel
  sem responsabilidade legal/financeira.

Falhas:

- `404 NOT_FOUND` se `personId` nao existir.
- `409 CONFLICT` se CPF existir com dados conflitantes.
- `422 BUSINESS_RULE_ERROR` se responsavel sem CPF tentar ser legal ou
  financeiro.

## 12. Criar ou reutilizar Profile de responsavel

Regras:

- Garantir um `Profile` do tipo `responsavel`.
- Reutilizar profile ativo quando existir para a mesma `Person`.
- Criar profile se nao existir.
- Nao duplicar profile ativo do mesmo tipo para a mesma pessoa.

Saidas por responsavel:

- `profileResponsavelId`.

## 13. Criar Relationship

Para cada responsavel:

```text
Validar relacionamento unico ativo
->
Validar flags
->
Criar relacionamento aluno-responsavel
```

Campos relevantes:

- `profileAlunoId`.
- `profileResponsavelId`.
- `tipo`.
- `responsavelLegal`.
- `financeiro`.
- `financeiroPrincipal`.
- `recebeComunicados`.
- `podeBuscar`.
- `emergencia`.
- `emergenciaPrincipal`.
- `prioridadeContato`.
- `vigenciaInicio`.
- `vigenciaFim`.

Saidas por responsavel:

- `relationshipId`.

Regra anti-duplicidade:

- Nao pode existir relacionamento ativo com mesmo `profileAlunoId`, mesmo
  `profileResponsavelId`, mesmo `tipo` e periodo de vigencia sobreposto.
- Se o responsavel acumular papeis, os papeis devem ficar no mesmo
  relacionamento, nao em registros duplicados.
- Reenvio idempotente deve retornar o relacionamento ja criado; reenvio sem
  idempotencia que tente duplicar relacionamento ativo deve retornar
  `409 CONFLICT`.

Falhas:

- `409 CONFLICT` para relacionamento duplicado.
- `422 BUSINESS_RULE_ERROR` para flags incoerentes.

## 14. Criar Enrollment/Matricula

Regras:

- Gerar `numeroMatricula` quando nao enviado.
- Validar disponibilidade se `numeroMatricula` for enviado.
- Associar matricula ao `profileAlunoId`.
- Associar turma, unidade, modalidade, horario e plano quando enviados.
- Definir `statusInicial`.
- Preservar dados minimos para compatibilidade com telas atuais.

Saidas:

- `enrollmentId`.
- `numeroMatricula`.
- `statusMatricula`.

Falhas:

- `404 NOT_FOUND` para IDs inexistentes.
- `409 CONFLICT` para numero de matricula indisponivel.
- `422 BUSINESS_RULE_ERROR` para combinacoes invalidas.

## 15. Registrar snapshots e metadata

Objetivo:

- Dar suporte a leitura por modulos legados durante migracao.
- Guardar `schemaVersion`.
- Registrar canal de origem.
- Preservar `submittedAt`.
- Facilitar auditoria e suporte.

Restricao:

- Snapshot nao deve virar fonte primaria de verdade quando `Person`, `Profile`,
  `Relationship` e `Enrollment` estiverem disponiveis.

## 16. Commit

Se todas as etapas concluirem:

```text
COMMIT
```

Depois do commit:

- Atualizar registro de idempotencia como concluido.
- Montar resposta com IDs criados/reutilizados.
- Retornar `201 Created`.

## 17. Rollback

Se qualquer etapa falhar:

```text
ROLLBACK
```

Garantias:

- Nao criar aluno sem responsavel quando regra exigir responsavel.
- Nao criar responsavel sem relacionamento quando esse responsavel veio no
  mesmo payload.
- Nao consumir numero de matricula se a matricula nao foi criada.
- Nao manter idempotencia como sucesso se a transacao falhar.

## Transacao detalhada

```text
BEGIN
->
Lock Idempotency-Key
->
Lock CPF aluno quando informado
->
Upsert/Reuse Person aluno
->
Upsert/Reuse Profile aluno
->
Para cada responsavel:
  Lock CPF responsavel quando informado
  Upsert/Reuse Person responsavel
  Upsert/Reuse Profile responsavel
  Validar unicidade de relacionamento
  Insert Relationship
->
Reservar numero de matricula
->
Insert Enrollment
->
Insert snapshots/metadados necessarios
->
Persistir resposta idempotente
->
COMMIT
```

Erro:

```text
Erro em qualquer etapa
->
ROLLBACK
->
Marcar idempotencia como falha recuperavel quando aplicavel
->
Retornar erro padronizado
```

## Ordem recomendada de validacao

1. Validacoes sintaticas sem acessar banco.
2. Normalizacao do payload.
3. Validacoes de negocio sem acessar banco.
4. Validacoes de existencia no banco.
5. Validacoes de conflito dentro da transacao.
6. Escritas.
7. Commit.
8. Resposta.

## Pontos de concorrencia

### CPF

Risco:

- Dois cadastros simultaneos tentam criar a mesma pessoa.

Mitigacao:

- Constraint unica por CPF normalizado quando CPF existir.
- Lock ou upsert transacional.

### Numero de matricula

Risco:

- Dois cadastros recebem o mesmo proximo numero.

Mitigacao:

- Reserva atomica dentro da transacao.

### Relacionamento duplicado

Risco:

- Dois cadastros tentam vincular mesmo aluno e mesmo responsavel.

Mitigacao:

- Constraint logica/fisica para relacionamento ativo.
- Checagem dentro da transacao.

### Idempotencia

Risco:

- Frontend reenvia request por timeout.

Mitigacao:

- `Idempotency-Key` com hash de payload.
- Resposta anterior reutilizada quando payload for igual.

## Eventos fora do escopo inicial

Nao executar automaticamente nesta Sprint de implementacao inicial sem contrato
adicional:

- Criacao de usuario do portal.
- Envio de notificacao.
- Geracao de contrato.
- Geracao de cobranca.
- Upload de documentos.
- Webhook externo.

Esses fluxos devem consumir os IDs retornados por `Cadastro V2` em endpoints ou
workers proprios.
