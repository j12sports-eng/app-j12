# Cadastro V2 - Contrato Oficial da API

Sprint 9.0 - Definicao de contrato. Este documento nao implementa endpoint,
controller, service, migration, teste ou tela. Ele define o acordo tecnico para
a Sprint 9.1 entre Frontend, Backend e Banco de Dados.

## 1. Objetivo da API

`Cadastro V2` centraliza a criacao de aluno, responsaveis, perfis,
relacionamentos e matricula inicial em uma operacao unica, validada e
transacional.

Finalidade:

- Receber um cadastro completo de aluno com um ou mais responsaveis.
- Separar identidade civil (`Person`) de papeis operacionais (`Profile`).
- Registrar o vinculo aluno-responsavel de forma explicita e auditavel.
- Criar a matricula inicial sem depender de dados duplicados em JSON solto.
- Permitir reutilizacao de responsaveis ja existentes, principalmente para
  irmaos.

Problemas que resolve:

- Dados pessoais duplicados em aluno, responsavel, usuario e snapshots.
- Cadastro atual limitado a um responsavel principal.
- Dificuldade de diferenciar responsavel legal, financeiro, comunicados,
  busca e emergencia.
- Risco de duplicar responsavel quando o mesmo CPF ou contato ja existe.
- Falta de contrato unico para Frontend, Backend e Banco.

Beneficios da nova arquitetura:

- Identidade unica por pessoa.
- Multiplos perfis para a mesma pessoa.
- Relacionamentos N:N entre alunos e responsaveis.
- Operacao atomica com `COMMIT` ou `ROLLBACK`.
- Respostas padronizadas com IDs de todos os recursos criados ou reutilizados.
- Base mais segura para contratos, financeiro, notificacoes, presencas e
  portais.

Diferencas em relacao ao cadastro atual:

| Cadastro atual | Cadastro V2 |
| --- | --- |
| Fluxo publica matricula em `/public/enrollments`. | Endpoint autenticado em `/api/v2/cadastros`. |
| Payload focado em formulario e snapshot. | Payload orientado a identidade, perfis e vinculos. |
| Responsavel principal como objeto unico. | `responsaveis[]` com um ou mais vinculos. |
| Relacao aluno-responsavel implicita. | Relacao explicita com flags de permissao. |
| Respostas legadas como `{ ok: true }`. | Envelope padrao com `success`, `data`, `requestId` e `timestamp`. |
| Persistencia pode duplicar dados. | Contrato preparado para reutilizar `Person` e `Profile`. |

## Versionamento e Compatibilidade de Migracao

`POST /api/v2/cadastros` deve coexistir com o fluxo atual durante toda a
migracao.

Regras de versionamento:

- A rota atual de matricula publica, como `/public/enrollments`, nao deve ser
  removida, renomeada ou ter contrato quebrado durante a Sprint 9.1.
- `Cadastro V2` e uma nova superficie de API, nao uma substituicao imediata do
  endpoint atual.
- Frontend legado pode continuar usando o fluxo atual enquanto o frontend
  administrativo migra para `/api/v2/cadastros`.
- Mudancas incompativeis em `Cadastro V2` exigem nova versao ou decisao
  documentada antes da implementacao.
- Adapters de compatibilidade podem ser criados futuramente, mas nao devem
  alterar o payload oficial documentado aqui.

Conclusao: a implementacao da Sprint 9.1 deve adicionar a API V2 em paralelo e
preservar compatibilidade com as rotas atuais.

## 2. Endpoint

Metodo HTTP:

```text
POST
```

URL canonica:

```text
/api/v2/cadastros
```

Content-Type:

```text
application/json
```

Headers obrigatorios:

```text
Authorization: Bearer <access_token>
Content-Type: application/json
Accept: application/json
```

Headers recomendados:

```text
X-Request-Id: req_01HYJ12CADASTROV2
Idempotency-Key: cad_01HYJ12ALUNO001
```

Autenticacao necessaria:

- Usuario autenticado.
- Token Bearer valido.
- Permissao minima: `cadastros:criar`.
- Perfis esperados: `admin` ou `coordenador`.

Fora do escopo desta Sprint:

- Variante publica sem autenticacao.
- Upload binario de documentos.
- Criacao de usuario de acesso do aluno ou responsavel.
- Geracao automatica de contrato e financeiro.

## 3. Payload de Entrada

Payload oficial:

```json
{
  "origem": {
    "canal": "ADMIN",
    "referenciaExterna": null,
    "observacoes": "Cadastro feito pela secretaria."
  },
  "aluno": {
    "personId": null,
    "nome": "Joao Pedro Silva",
    "nomeSocial": null,
    "cpf": null,
    "rg": "12.345.678-9",
    "sexo": "MASCULINO",
    "dataNascimento": "2014-05-20",
    "email": null,
    "telefone": null,
    "endereco": {
      "cep": "01001000",
      "logradouro": "Rua Exemplo",
      "numero": "100",
      "complemento": "Apto 12",
      "bairro": "Centro",
      "cidade": "Sao Paulo",
      "estado": "SP",
      "pais": "BR"
    },
    "dadosEscolares": {
      "colegio": "Colegio Exemplo",
      "periodoEscolar": "MANHA"
    },
    "saude": {
      "restricaoMedica": null,
      "medicamentos": null,
      "alergias": null,
      "lesoes": null,
      "planoSaude": null,
      "observacoesImportantes": null
    }
  },
  "responsaveis": [
    {
      "personId": null,
      "nome": "Maria Silva",
      "cpf": "12345678909",
      "rg": "22.333.444-5",
      "telefone": "1133334444",
      "whatsapp": "11999998888",
      "email": "maria@example.com",
      "endereco": null,
      "relacionamento": {
        "tipo": "MAE",
        "responsavelLegal": true,
        "financeiro": true,
        "financeiroPrincipal": true,
        "recebeComunicados": true,
        "podeBuscar": true,
        "emergencia": true,
        "emergenciaPrincipal": true,
        "prioridadeContato": 1,
        "vigenciaInicio": "2026-06-29",
        "vigenciaFim": null,
        "observacoes": null
      }
    }
  ],
  "matricula": {
    "numeroMatricula": null,
    "dataMatricula": "2026-06-29",
    "statusInicial": "PENDENTE",
    "modalidadeIds": ["mod_futsal"],
    "unidadeIds": ["und_matriz"],
    "turmaIds": ["tur_sub13"],
    "horarioIds": ["hor_seg_qua_18"],
    "planoId": null,
    "observacoes": null
  },
  "documentos": {
    "fotoPerfilAluno": null,
    "rgCpfAluno": null,
    "rgCpfResponsavel": null,
    "comprovanteEndereco": null,
    "atestadoMedico": null
  },
  "metadata": {
    "schemaVersion": "2.0",
    "submittedAt": "2026-06-29T09:00:00.000Z",
    "frontendVersion": null
  }
}
```

### Campos adicionados ao exemplo inicial

| Campo | Motivo |
| --- | --- |
| `responsaveis[]` | Permite aluno com mae, pai, avo, tios ou outros responsaveis. |
| `personId` | Permite reutilizar pessoa ja existente sem duplicar CPF ou contato. |
| `matricula` | O cadastro precisa devolver uma matricula operacional. |
| `endereco` | Usado por contrato, financeiro, comunicacao e cadastro completo. |
| `dadosEscolares` | Ja existe no formulario atual e deve continuar disponivel. |
| `saude` | Suporta seguranca operacional e pendencias medicas. |
| `documentos` | Mantem referencia documental sem exigir upload binario nesta API. |
| `origem` | Ajuda auditoria, suporte e conciliacao de canais. |
| `metadata` | Permite versionamento do contrato e rastreio de submissao. |
| `financeiroPrincipal` | Evita ambiguidade quando ha mais de um responsavel financeiro. |
| `emergencia` e `emergenciaPrincipal` | Garante contato de emergencia por aluno. |
| `prioridadeContato` | Define ordem de comunicacao operacional. |
| `vigenciaInicio` e `vigenciaFim` | Permite revogar vinculos sem apagar historico. |

## 4. Regras de Negocio

### Identidade

- Nome do aluno e obrigatorio.
- Nome de cada responsavel e obrigatorio.
- CPF do aluno e opcional.
- CPF do responsavel e obrigatorio quando ele for `responsavelLegal`,
  `financeiro` ou `financeiroPrincipal`.
- CPF do responsavel pode ser ausente apenas para contato de emergencia,
  autorizado para busca ou outro vinculo sem responsabilidade legal/financeira.
- CPF informado deve ser valido e normalizado para 11 digitos.
- CPF valido deve apontar para uma unica `Person` ativa.
- `personId`, quando informado, tem prioridade sobre busca por CPF, mas deve
  existir e ser compativel com os dados enviados.
- Dados pessoais comuns pertencem a `Person`, nao ao perfil.

### Aluno

- Data de nascimento do aluno e obrigatoria.
- Sexo do aluno e obrigatorio no contrato V2.
- Aluno menor ativo deve ter ao menos um responsavel legal ativo.
- Aluno ativo deve ter ao menos um contato de emergencia ativo.
- Aluno com cobranca recorrente deve ter responsavel financeiro principal,
  salvo decisao futura permitindo o proprio aluno como pagador.
- Um aluno pode possuir varios responsaveis.
- O mesmo aluno nao pode ter dois relacionamentos ativos identicos com o mesmo
  responsavel e mesmo tipo.

### Responsaveis

- `responsaveis[]` deve aceitar multiplos responsaveis desde o primeiro
  release da API V2.
- O array deve aceitar de 1 a 10 itens no contrato inicial.
- Um responsavel pode estar vinculado a varios alunos.
- O mesmo responsavel pode ser reutilizado para irmaos.
- Um responsavel pode acumular papeis no mesmo relacionamento: legal,
  financeiro, comunicados, busca e emergencia.
- Um responsavel pode receber comunicados de um aluno e nao receber de outro.
- Um responsavel pode buscar um aluno e nao estar autorizado para outro.
- Remover ou inativar responsavel nao pode apagar historico de contratos,
  cobrancas, comunicados ou autorizacoes.

### Relacionamento

- Cada item de `responsaveis[]` cria ou reutiliza uma `Person` de responsavel,
  garante `Profile` de responsavel e cria um relacionamento com o aluno.
- Um relacionamento e considerado duplicado quando existe vinculo ativo para o
  mesmo `profileAlunoId`, mesmo `profileResponsavelId`, mesmo
  `relacionamento.tipo` e periodo de vigencia sobreposto.
- O mesmo responsavel pode ter mais de um papel no mesmo relacionamento; isso
  nao deve gerar linhas duplicadas.
- Pelo menos um papel deve ser verdadeiro em `relacionamento`.
- `financeiroPrincipal=true` exige `financeiro=true`.
- Apenas um relacionamento ativo pode ter `financeiroPrincipal=true` por aluno
  no mesmo periodo.
- Apenas um relacionamento ativo pode ter `emergenciaPrincipal=true` por aluno
  no mesmo periodo.
- `vigenciaFim`, quando informada, nao pode ser anterior a `vigenciaInicio`.
- Relacionamento duplicado deve retornar `409 Conflict`.

### Reutilizacao de Pessoas

- Se `personId` for informado, o backend deve buscar essa `Person` e reutilizar
  o registro quando ele existir e for compativel com os dados enviados.
- Se `personId` nao for informado e `cpf` valido for informado, o backend deve
  buscar `Person` ativa por CPF normalizado e reutilizar o registro compativel.
- Se `personId` e `cpf` forem informados, ambos devem apontar para a mesma
  pessoa; divergencia deve retornar `409 Conflict`.
- Se uma `Person` existente for encontrada por CPF com nome, nascimento ou
  documento claramente conflitante, a API deve retornar `409 Conflict` em vez
  de criar duplicidade silenciosa.
- Se nao houver `personId` nem CPF e a regra permitir cadastro sem CPF, o
  backend pode criar nova `Person`, aplicando deduplicacao assistida por nome,
  data de nascimento e contato quando possivel.
- Reutilizar `Person` nao significa reutilizar relacionamento: para cada aluno,
  o backend ainda deve criar ou validar o relacionamento especifico.

### Matricula

- `matricula.statusInicial` deve ser um valor permitido.
- `matricula.numeroMatricula` pode ser omitido para geracao automatica.
- Se `numeroMatricula` for enviado, deve estar disponivel.
- `turmaIds`, `modalidadeIds`, `unidadeIds`, `horarioIds` e `planoId`, quando
  enviados, devem existir e estar ativos.
- Criar contrato, criar financeiro e criar usuario de portal ficam fora do
  endpoint inicial, mas o retorno deve fornecer IDs suficientes para esses
  fluxos posteriores.

### Idempotencia

- Reenvio com o mesmo `Idempotency-Key` e mesmo payload normalizado deve
  retornar o mesmo resultado logico da primeira requisicao concluida, sem criar
  novo aluno, responsavel, relacionamento ou matricula.
- Reenvio com o mesmo `Idempotency-Key` e payload diferente deve retornar
  `409 Conflict`.
- Reenvio enquanto a primeira requisicao ainda estiver em processamento deve
  retornar uma resposta controlada, preferencialmente `409 Conflict` com codigo
  `IDEMPOTENCY_IN_PROGRESS`, ou aguardar a conclusao se a infraestrutura da
  Sprint 9.1 suportar espera segura.
- Timeout no frontend ou clique duplo devem ser tratados por idempotencia: a
  segunda chamada com mesma chave e mesmo payload nao pode duplicar registros.
- Operacoes sem `Idempotency-Key` sao aceitas, mas o frontend deve enviar o
  header para evitar duplicidade em timeout.

## 5. Validacoes

### Obrigatorios por secao

| Campo | Obrigatorio | Regra |
| --- | --- | --- |
| `aluno.nome` | Sim | Texto entre 3 e 191 caracteres. |
| `aluno.dataNascimento` | Sim | Data ISO `YYYY-MM-DD`. |
| `aluno.sexo` | Sim | Enum de sexo. |
| `responsaveis` | Sim | Array com 1 a 10 itens. |
| `responsaveis[].nome` | Sim | Texto entre 3 e 191 caracteres. |
| `responsaveis[].relacionamento.tipo` | Sim | Enum de relacionamento. |
| `matricula.dataMatricula` | Sim | Data ISO `YYYY-MM-DD`. |
| `matricula.statusInicial` | Sim | Enum de status de matricula. |
| `metadata.schemaVersion` | Sim | Valor inicial: `2.0`. |

### Opcionais relevantes

| Campo | Regra |
| --- | --- |
| `aluno.cpf` | Opcional; se informado, 11 digitos validos. |
| `aluno.rg` | Opcional; ate 30 caracteres. |
| `aluno.email` | Opcional; email valido ate 191 caracteres. |
| `aluno.telefone` | Opcional; 10 a 13 digitos apos normalizacao. |
| `responsaveis[].personId` | Opcional; se informado, deve existir. |
| `responsaveis[].cpf` | Condicional; obrigatorio para legal/financeiro. |
| `responsaveis[].email` | Opcional; obrigatorio se for canal unico de comunicado. |
| `responsaveis[].telefone` | Opcional; 10 a 13 digitos. |
| `responsaveis[].whatsapp` | Opcional; 10 a 13 digitos. |
| `documentos.*` | Opcional; metadados apenas, sem binario. |

### Tipos e tamanhos

| Campo | Tipo | Tamanho/Formato |
| --- | --- | --- |
| `nome`, `aluno.nome`, `responsaveis[].nome` | string | 3 a 191 caracteres. |
| `cpf` | string/null | 11 digitos validos, mascara aceita na entrada. |
| `rg` | string/null | Ate 30 caracteres. |
| `email` | string/null | Email valido ate 191 caracteres. |
| `telefone`, `whatsapp` | string/null | 10 a 13 digitos normalizados. |
| `dataNascimento`, `dataMatricula` | string | `YYYY-MM-DD`. |
| `estado` | string/null | UF com 2 caracteres quando Brasil. |
| `relacionamento.prioridadeContato` | integer/null | 1 a 99. |
| `observacoes` | string/null | Ate 1000 caracteres. |
| `*_Ids` | string[] | IDs existentes e ativos. |

### Enumeracoes

`origem.canal`:

```text
ADMIN
PUBLICO
IMPORTACAO
MIGRACAO
API
```

`aluno.sexo`:

```text
MASCULINO
FEMININO
OUTRO
NAO_INFORMADO
```

`responsaveis[].relacionamento.tipo`:

```text
MAE
PAI
AVO
TIA
TIO
IRMAO
IRMA
RESPONSAVEL_LEGAL
OUTRO
```

Observacao: a API deve usar enums ASCII. A UI pode exibir labels com acento,
mas deve enviar valores canonicos como `AVO` e `IRMA`.

`matricula.statusInicial`:

```text
PENDENTE
EXPERIMENTAL
ATIVA
INCOMPLETA
```

`person/profile status` para mapeamento interno:

```text
ativo
pendente
inativo
bloqueado
```

## 6. Fluxo de Execucao

Resumo:

```text
Receber Request
->
Validar autenticacao e permissao
->
Validar Content-Type e Idempotency-Key
->
Validar schema do payload
->
Normalizar CPF, telefone, email, datas e enums
->
Validar regras de negocio
->
Abrir transacao
->
Criar ou reutilizar Person do aluno
->
Criar ou reutilizar Profile de aluno
->
Para cada responsavel:
  Criar ou reutilizar Person do responsavel
  Criar ou reutilizar Profile de responsavel
  Criar relacionamento aluno-responsavel
->
Criar matricula inicial
->
Registrar snapshots/metadados necessarios para compatibilidade
->
COMMIT
->
Retornar IDs
```

Detalhamento completo em [CADASTRO_V2_FLUXO.md](./CADASTRO_V2_FLUXO.md).

## 7. Transacao

Toda a operacao deve ocorrer dentro de uma unica transacao.

```text
BEGIN
->
Reservar Idempotency-Key
->
Criar/Reutilizar Person do aluno
->
Criar/Reutilizar Profile de aluno
->
Criar/Reutilizar Person dos responsaveis
->
Criar/Reutilizar Profiles de responsaveis
->
Criar Relationships
->
Criar Enrollment/Matricula
->
Atualizar registro de idempotencia com resultado
->
COMMIT
```

Em caso de erro:

```text
ROLLBACK
->
Retornar erro padronizado
->
Nao deixar pessoa, perfil, relacionamento ou matricula parcial
```

## 8. Respostas da API

Todas as respostas novas devem usar envelope padrao:

```json
{
  "success": true,
  "data": {},
  "meta": {},
  "requestId": "req_01HYJ12CADASTROV2",
  "timestamp": "2026-06-29T09:00:00.000Z"
}
```

Todas as respostas de erro de endpoints sob `/api/v2/*` devem usar o mesmo
formato. Rotas legadas podem manter formato antigo ate serem migradas, mas
qualquer novo endpoint V2 deve retornar o envelope abaixo.

Erros V2 devem usar:

```json
{
  "success": false,
  "message": "Dados invalidos.",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "aluno.nome",
      "message": "Informe o nome do aluno."
    }
  ],
  "requestId": "req_01HYJ12CADASTROV2",
  "timestamp": "2026-06-29T09:00:00.000Z"
}
```

Campos obrigatorios em erros V2:

| Campo | Obrigatorio | Observacao |
| --- | --- | --- |
| `success` | Sim | Sempre `false`. |
| `message` | Sim | Mensagem segura para exibicao ao usuario. |
| `code` | Sim | Codigo estavel para tratamento no frontend. |
| `details` | Nao | Obrigatorio quando houver erro por campo ou regra especifica. |
| `requestId` | Sim | Mesmo valor recebido ou gerado pelo backend. |
| `timestamp` | Sim | ISO 8601. |

Exemplos completos de `201`, `400`, `401`, `403`, `404`, `409`, `422` e
`500` estao em [CADASTRO_V2_EXEMPLOS.md](./CADASTRO_V2_EXEMPLOS.md).

## 9. Estrutura da Resposta

Resposta oficial para sucesso:

```json
{
  "success": true,
  "data": {
    "cadastroId": "cad_01HYJ12",
    "personAlunoId": "per_aluno_001",
    "profileAlunoId": "prf_aluno_001",
    "enrollmentId": "mat_001",
    "numeroMatricula": "202600123",
    "statusMatricula": "PENDENTE",
    "responsaveis": [
      {
        "personResponsavelId": "per_resp_001",
        "profileResponsavelId": "prf_resp_001",
        "relationshipId": "rel_001",
        "tipo": "MAE",
        "responsavelLegal": true,
        "financeiro": true,
        "financeiroPrincipal": true,
        "recebeComunicados": true,
        "podeBuscar": true,
        "emergencia": true
      }
    ]
  },
  "requestId": "req_01HYJ12CADASTROV2",
  "timestamp": "2026-06-29T09:00:00.000Z"
}
```

Para casos com apenas um responsavel, `responsaveis[0]` substitui os campos
singulares do exemplo inicial:

```json
{
  "personAlunoId": "per_aluno_001",
  "personResponsavelId": "per_resp_001",
  "profileAlunoId": "prf_aluno_001",
  "profileResponsavelId": "prf_resp_001",
  "relationshipId": "rel_001"
}
```

O contrato oficial usa `data.responsaveis[]` para suportar multiplos
responsaveis sem criar outra versao.

## 10. Casos de Uso

Casos documentados:

- Aluno com apenas mae.
- Aluno com mae e pai.
- Aluno com avo responsavel financeira.
- Dois irmaos compartilhando o mesmo responsavel.
- Responsavel ja existente.
- Aluno sem CPF.
- Responsavel sem CPF permitido apenas para emergencia/busca/outro.

Exemplos completos em [CADASTRO_V2_EXEMPLOS.md](./CADASTRO_V2_EXEMPLOS.md).

## 11. Casos de Erro

Situacoes obrigatorias:

- CPF duplicado com dados conflitantes.
- Relacionamento duplicado.
- Telefone invalido.
- Data invalida.
- Campos obrigatorios ausentes.
- Permissoes inconsistentes.
- Responsavel financeiro principal duplicado.
- Contato de emergencia principal duplicado.
- `financeiroPrincipal=true` sem `financeiro=true`.
- Responsavel legal/financeiro sem CPF.
- IDs de turma, unidade, modalidade, horario ou plano inexistentes.
- Idempotency-Key reutilizada com payload diferente.

Exemplos completos em [CADASTRO_V2_EXEMPLOS.md](./CADASTRO_V2_EXEMPLOS.md).

## 12. Diagrama da Arquitetura

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

Diagrama detalhado em [CADASTRO_V2_FLUXO.md](./CADASTRO_V2_FLUXO.md).

## 13. Checklist de Aprovacao

Checklist oficial em [CADASTRO_V2_CHECKLIST.md](./CADASTRO_V2_CHECKLIST.md).

Resumo minimo:

- [x] Payload definido.
- [x] Regras documentadas.
- [x] Respostas documentadas.
- [x] Validacoes definidas.
- [x] Casos de erro documentados.
- [x] Fluxo documentado.
- [x] Transacao definida.
- [x] Frontend consegue consumir o contrato.
- [x] Backend consegue implementar a partir do contrato.
- [x] Banco possui requisitos claros para suportar o contrato.

## 14. Entregaveis

Arquivos da Sprint 9.0:

- `docs/API/CADASTRO_V2.md`
- `docs/API/CADASTRO_V2_EXEMPLOS.md`
- `docs/API/CADASTRO_V2_FLUXO.md`
- `docs/API/CADASTRO_V2_CHECKLIST.md`
- `docs/API/CADASTRO_V2_DECISOES.md`

## Restricoes atendidas

- Nenhum codigo de backend foi alterado.
- Nenhum codigo de frontend foi alterado.
- Nenhuma migration foi criada.
- Nenhum endpoint foi criado.
- Nenhuma rota foi modificada.
- Nenhum teste foi criado.
- Nenhum repository, service ou controller foi criado.
