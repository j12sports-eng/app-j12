# Cadastro V2 - Decisoes, Assumptions e Pontos Pendentes

Este documento registra as decisoes da Sprint 9.0 para evitar ambiguidade na
Sprint 9.1.

## Decisoes aprovadas para o contrato

### 1. Endpoint autenticado

Decisao:

```text
POST /api/v2/cadastros
```

Motivo:

- Cadastro V2 cria registros sensiveis e deve ser protegido.
- O fluxo publico atual continua separado.
- Permite aplicar permissao `cadastros:criar`.

Impacto:

- Frontend administrativo consome V2.
- Formularios publicos podem ganhar adapter futuro, mas nao fazem parte deste
  contrato.
- A rota V2 deve coexistir com os endpoints atuais durante a migracao.
- Nenhuma rota atual deve ser removida ou ter contrato quebrado para implementar
  `/api/v2/cadastros`.

### 2. Payload usa `responsaveis[]`

Decisao:

- O contrato oficial usa array de responsaveis.

Motivo:

- Um aluno pode ter varios responsaveis.
- O mesmo responsavel pode ter papeis diferentes por aluno.
- Evita criar V3 apenas para suportar mae e pai.

Impacto:

- Tela com um unico responsavel envia array com um item.
- Backend sempre processa lista.
- Multiplos responsaveis devem funcionar desde o primeiro release de V2.
- Relacionamentos duplicados devem ser bloqueados por regra de negocio e por
  protecao transacional.

### 3. `Person` e separado de `Profile`

Decisao:

- Identidade civil fica em `Person`.
- Papel operacional fica em `Profile`.

Motivo:

- Uma mesma pessoa pode ser responsavel, aluno, professor ou funcionario.
- Evita duplicidade de nome, CPF, email e telefone.

Impacto:

- API retorna IDs separados: `personAlunoId`, `profileAlunoId`,
  `personResponsavelId`, `profileResponsavelId`.

### 4. Relacionamento contem as permissoes

Decisao:

- Legal, financeiro, comunicados, busca e emergencia pertencem ao
  relacionamento aluno-responsavel.

Motivo:

- Uma pessoa pode ser financeira para um aluno e apenas emergencia para outro.
- Permissoes dependem do contexto do aluno.

Impacto:

- `responsavelFinanceiro` nao deve ser atributo global da pessoa.
- Alteracao de vinculo deve preservar historico.

### 5. CPF do aluno e opcional

Decisao:

- `aluno.cpf` e opcional.

Motivo:

- Alunos menores podem nao ter CPF informado no primeiro cadastro.
- Nome, data de nascimento e responsavel legal permitem cadastro inicial.

Impacto:

- Deduplicacao de aluno sem CPF exige estrategia por nome, nascimento e
  responsavel.
- Backend deve lidar com possiveis homonimos.

### 6. CPF do responsavel e condicional

Decisao:

- CPF do responsavel e obrigatorio para responsavel legal ou financeiro.
- CPF pode ser ausente para contato de emergencia, autorizado para busca ou
  outro vinculo sem responsabilidade legal/financeira.

Motivo:

- Responsabilidade legal/financeira exige identificacao forte.
- Pessoas autorizadas para busca podem ser cadastradas de forma operacional
  com nome e telefone.

Impacto:

- Payload com `responsavelLegal=true` e `cpf=null` retorna `422`.
- Payload com `financeiro=true` e `cpf=null` retorna `422`.

### 7. Enums canonicos sao ASCII

Decisao:

- A API recebe enums sem acento, como `MAE`, `AVO`, `IRMA`.

Motivo:

- Evita divergencia de encoding.
- Facilita integracao e validacao.
- UI pode exibir labels amigaveis com acento.

Impacto:

- Frontend deve mapear label visual para enum canonico.

### 8. Operacao deve ser transacional

Decisao:

- Cadastro V2 e uma operacao atomica.

Motivo:

- Nao pode existir aluno criado sem responsavel quando regra exige responsavel.
- Nao pode existir relacionamento sem profiles validos.
- Nao pode consumir numero de matricula em falha parcial.

Impacto:

- Backend deve implementar service transacional.
- Banco deve suportar rollback das etapas envolvidas.
- A transacao obrigatoria cobre a cadeia completa `Person -> Profile ->
  Relationship -> Enrollment`.
- Falha em qualquer etapa exige rollback completo.

### 9. Resposta oficial usa envelope padrao

Decisao:

- Respostas usam `success`, `data`, `meta`, `requestId`, `timestamp`.

Motivo:

- Alinha com `docs/ARQUITETURA/PADROES_API.md`.
- Facilita tratamento uniforme no frontend.

Impacto:

- Novas telas devem ler `data`.
- Erros devem ler `details[]`.
- Todos os endpoints sob `/api/v2/*` devem usar o mesmo formato de erro.
- Rotas legadas podem manter formatos antigos ate migracao propria.

### 10. Contrato inclui `matricula`

Decisao:

- Cadastro V2 tambem cria a matricula inicial.

Motivo:

- O objetivo operacional do cadastro de aluno e deixar o aluno matriculavel e
  rastreavel.
- O formulario atual ja coleta numero/categoria/turma/modalidade.

Impacto:

- Backend retorna `enrollmentId` e `numeroMatricula`.
- Geracao de contrato e financeiro continuam fora do escopo inicial.

### 11. Upload binario fica fora do endpoint

Decisao:

- `documentos` aceita metadados, nao arquivos binarios.

Motivo:

- Evita misturar cadastro transacional com upload.
- Upload pode ter endpoint proprio, storage proprio e retry proprio.

Impacto:

- Frontend pode enviar referencias documentais se ja existirem.
- Upload posterior deve usar contrato separado.

### 12. Idempotencia e recomendada

Decisao:

- `Idempotency-Key` e obrigatoria como comportamento suportado pelo backend e
  recomendada como envio padrao pelo frontend.

Motivo:

- Cadastro e operacao sensivel a reenvio por timeout.
- Evita alunos duplicados.
- Cobre clique duplo, retry automatico e perda de resposta apos commit.

Impacto:

- Sprint 9.1 deve prever tabela/mecanismo de idempotencia ou solucao
  equivalente.
- Mesma chave com mesmo payload concluido retorna a mesma resposta logica.
- Mesma chave com payload diferente retorna `409 CONFLICT`.
- Mesma chave com request em andamento retorna `IDEMPOTENCY_IN_PROGRESS` ou
  aguarda conclusao se a implementacao suportar espera segura.

### 13. Reutilizacao de pessoas existentes

Decisao:

- Responsavel existente deve ser reutilizado quando `personId` for valido e
  compativel.
- Responsavel existente deve ser reutilizado quando CPF normalizado ja existir
  em uma `Person` ativa compativel.
- Criar nova `Person` com CPF ja existente e compativel e proibido.

Motivo:

- Evita duplicidade de responsaveis.
- Permite cadastro correto de irmaos com o mesmo responsavel.
- Mantem historico de comunicacao, financeiro e autorizacoes por pessoa.

Impacto:

- `personId` e CPF divergentes retornam `409 CONFLICT`.
- CPF existente com dados conflitantes retorna `409 CONFLICT`.
- Reuso de pessoa nao dispensa criacao ou validacao do relacionamento por
  aluno.

### 14. Compatibilidade com frontend atual

Decisao:

- O contrato V2 esta fechado para implementacao da Sprint 9.1 e nao deve sofrer
  mudancas de payload durante a codificacao sem nova revisao.

Motivo:

- Evita retrabalho no frontend.
- Permite implementar formulario de um responsavel hoje e multiplos
  responsaveis sem mudar o contrato.
- Garante tratamento previsivel de erros por campo via `details[]`.

Impacto:

- Campos opcionais podem ser omitidos pelo frontend atual.
- Tela atual consegue enviar `responsaveis[]` com um item.
- Evolucao para mae/pai/avo usa o mesmo array.

## Decisoes pendentes para Sprint 9.1

### 1. Motor de banco ativo

Ponto:

- As instrucoes gerais citam PostgreSQL, mas a documentacao e o codigo atuais
  do repositorio citam MySQL/mysql2 em varios pontos.

Decisao pendente:

- Confirmar motor de banco que a Sprint 9.1 deve implementar.

Impacto:

- Sintaxe de transacao, locks, constraints parciais e upserts mudam entre
  bancos.

### 2. Nome fisico das tabelas

Ponto:

- O contrato usa nomes conceituais: `Person`, `Profile`, `Relationship`,
  `Enrollment`.

Decisao pendente:

- Confirmar nomes fisicos finais das tabelas.

Impacto:

- Migrations e repositories da Sprint 9.1 dependem dessa decisao.

### 3. Padrao de IDs

Ponto:

- O contrato usa exemplos como `per_`, `prf_`, `rel_`, `mat_`.

Decisao pendente:

- Confirmar se IDs serao UUID, prefixados, numericos ou outro padrao.

Impacto:

- Frontend deve tratar IDs como string.
- Banco e logs devem preservar rastreabilidade.

### 4. Status inicial padrao

Ponto:

- O contrato permite `PENDENTE`, `EXPERIMENTAL`, `ATIVA`, `INCOMPLETA`.

Decisao pendente:

- Confirmar se o primeiro release aceita `ATIVA` ou se todo cadastro nasce
  `PENDENTE`.

Impacto:

- Regras de responsavel legal, emergencia, financeiro e documentos podem ser
  mais rigidas para status `ATIVA`.

### 5. Aluno maior de idade sem responsavel

Ponto:

- O contrato exige `responsaveis[]` com ao menos um item nesta versao.

Decisao pendente:

- Confirmar se aluno maior de idade podera ser o proprio responsavel em versao
  futura.

Impacto:

- Pode exigir relacionamento auto-referenciado ou perfil financeiro no aluno.

### 6. Contrato e financeiro

Ponto:

- Cadastro V2 retorna IDs suficientes para contrato e financeiro, mas nao cria
  esses recursos automaticamente.

Decisao pendente:

- Confirmar se Sprint posterior tera endpoints separados ou worker automatico.

Impacto:

- Afeta UX pos-cadastro e automacoes.

### 7. Limite maximo de responsaveis

Ponto:

- Contrato sugere 1 a 10 responsaveis.

Decisao pendente:

- Confirmar limite operacional real.

Impacto:

- Afeta validacao frontend/backend e layout da tela.

### 8. Regras de deduplicacao sem CPF

Ponto:

- Aluno sem CPF e responsavel sem CPF permitido em casos restritos podem gerar
  homonimos.

Decisao pendente:

- Definir algoritmo oficial de sugestao de duplicidade sem bloquear cadastros
  legitimos.

Impacto:

- Pode exigir tela de confirmacao de possivel duplicidade.

## Assumptions usadas na documentacao

- Frontend administrativo sera o primeiro consumidor.
- Backend aplicara autenticacao e permissao antes do validator de negocio.
- Banco tera mecanismo para transacao atomica.
- IDs retornados serao strings.
- CPF sera armazenado normalizado, sem mascara.
- Telefone e WhatsApp serao armazenados normalizados, sem mascara.
- Labels com acento pertencem a UI; API recebe enums canonicos.
- O cadastro nao envia senha nem cria usuario de portal.
- Upload de documento ficara em endpoint proprio.
- Contrato, financeiro e notificacoes serao fluxos posteriores.

## Fora do escopo confirmado

- Implementar endpoint.
- Implementar controller.
- Implementar service.
- Implementar repository.
- Criar migrations.
- Criar testes.
- Alterar frontend.
- Alterar banco.
- Criar rota publica V2.
- Criar usuario de portal.
- Gerar contrato.
- Gerar cobranca.
- Enviar notificacao.

## Riscos conhecidos

| Risco | Mitigacao proposta |
| --- | --- |
| Divergencia entre banco citado nas instrucoes e banco atual do repo. | Confirmar motor antes da Sprint 9.1. |
| Duplicidade de pessoa sem CPF. | Usar deduplicacao assistida por nome, nascimento e contato. |
| Reenvio por timeout criando aluno duplicado. | Suportar `Idempotency-Key`. |
| Dois responsaveis financeiros principais. | Validacao no payload e constraint/lock no banco. |
| Relacionamento duplicado. | Checagem transacional e constraint logica/fisica. |
| Snapshot legado divergente. | Definir `Person/Profile/Relationship` como fonte primaria. |
| Upload atrasar transacao. | Separar upload binario em endpoint proprio. |

## Criterio de pronto para implementar

O contrato esta pronto para Sprint 9.1 quando:

- Time confirma motor de banco.
- Time confirma nomes de tabelas ou adapters.
- Time confirma padrao de IDs.
- Time confirma status inicial permitido.
- Frontend aprova payload com `responsaveis[]`.
- Backend aprova envelope de resposta e codigos.
- Banco aprova regras de unicidade e transacao.
