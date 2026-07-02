# Cadastro V2 - Exemplos de Payloads e Respostas

Este arquivo complementa o contrato principal em
[CADASTRO_V2.md](./CADASTRO_V2.md). Todos os exemplos sao ilustrativos e nao
representam implementacao pronta.

## Headers comuns

```http
POST /api/v2/cadastros HTTP/1.1
Authorization: Bearer <access_token>
Content-Type: application/json
Accept: application/json
X-Request-Id: req_01HYJ12CADASTROV2
Idempotency-Key: cad_01HYJ12ALUNO001
```

## Caso 1 - Aluno com apenas mae

```json
{
  "origem": {
    "canal": "ADMIN",
    "referenciaExterna": null,
    "observacoes": null
  },
  "aluno": {
    "personId": null,
    "nome": "Joao Pedro Silva",
    "cpf": null,
    "rg": null,
    "sexo": "MASCULINO",
    "dataNascimento": "2014-05-20",
    "email": null,
    "telefone": null,
    "endereco": null,
    "dadosEscolares": {
      "colegio": "Colegio Exemplo",
      "periodoEscolar": "MANHA"
    },
    "saude": null
  },
  "responsaveis": [
    {
      "personId": null,
      "nome": "Maria Silva",
      "cpf": "12345678909",
      "rg": null,
      "telefone": null,
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
    "horarioIds": [],
    "planoId": null,
    "observacoes": null
  },
  "documentos": {},
  "metadata": {
    "schemaVersion": "2.0",
    "submittedAt": "2026-06-29T09:00:00.000Z",
    "frontendVersion": null
  }
}
```

## Caso 2 - Aluno com mae e pai

```json
{
  "origem": {
    "canal": "ADMIN"
  },
  "aluno": {
    "nome": "Ana Clara Santos",
    "cpf": null,
    "sexo": "FEMININO",
    "dataNascimento": "2015-09-10"
  },
  "responsaveis": [
    {
      "nome": "Patricia Santos",
      "cpf": "12345678909",
      "whatsapp": "11999990000",
      "email": "patricia@example.com",
      "relacionamento": {
        "tipo": "MAE",
        "responsavelLegal": true,
        "financeiro": true,
        "financeiroPrincipal": true,
        "recebeComunicados": true,
        "podeBuscar": true,
        "emergencia": true,
        "emergenciaPrincipal": true,
        "prioridadeContato": 1
      }
    },
    {
      "nome": "Carlos Santos",
      "cpf": "98765432100",
      "whatsapp": "11988887777",
      "email": "carlos@example.com",
      "relacionamento": {
        "tipo": "PAI",
        "responsavelLegal": true,
        "financeiro": false,
        "financeiroPrincipal": false,
        "recebeComunicados": true,
        "podeBuscar": true,
        "emergencia": true,
        "emergenciaPrincipal": false,
        "prioridadeContato": 2
      }
    }
  ],
  "matricula": {
    "dataMatricula": "2026-06-29",
    "statusInicial": "PENDENTE",
    "modalidadeIds": ["mod_futsal"],
    "unidadeIds": ["und_matriz"],
    "turmaIds": ["tur_sub11"]
  },
  "metadata": {
    "schemaVersion": "2.0",
    "submittedAt": "2026-06-29T09:10:00.000Z"
  }
}
```

## Caso 3 - Avo responsavel financeira

```json
{
  "origem": {
    "canal": "ADMIN"
  },
  "aluno": {
    "nome": "Pedro Henrique Lima",
    "cpf": null,
    "sexo": "MASCULINO",
    "dataNascimento": "2013-03-15"
  },
  "responsaveis": [
    {
      "nome": "Luciana Lima",
      "cpf": "11122233344",
      "whatsapp": "11977776666",
      "email": "luciana@example.com",
      "relacionamento": {
        "tipo": "MAE",
        "responsavelLegal": true,
        "financeiro": false,
        "financeiroPrincipal": false,
        "recebeComunicados": true,
        "podeBuscar": true,
        "emergencia": true,
        "emergenciaPrincipal": true,
        "prioridadeContato": 1
      }
    },
    {
      "nome": "Helena Lima",
      "cpf": "55566677788",
      "whatsapp": "11966665555",
      "email": "helena@example.com",
      "relacionamento": {
        "tipo": "AVO",
        "responsavelLegal": false,
        "financeiro": true,
        "financeiroPrincipal": true,
        "recebeComunicados": true,
        "podeBuscar": false,
        "emergencia": false,
        "emergenciaPrincipal": false,
        "prioridadeContato": 2
      }
    }
  ],
  "matricula": {
    "dataMatricula": "2026-06-29",
    "statusInicial": "PENDENTE",
    "modalidadeIds": ["mod_futsal"],
    "unidadeIds": ["und_matriz"],
    "turmaIds": ["tur_sub13"],
    "planoId": "plano_mensal"
  },
  "metadata": {
    "schemaVersion": "2.0",
    "submittedAt": "2026-06-29T09:20:00.000Z"
  }
}
```

## Caso 4 - Dois irmaos compartilhando o mesmo responsavel

Primeiro cadastro cria ou reutiliza a pessoa da responsavel.

```json
{
  "aluno": {
    "nome": "Rafael Souza",
    "sexo": "MASCULINO",
    "dataNascimento": "2012-08-10"
  },
  "responsaveis": [
    {
      "nome": "Bianca Souza",
      "cpf": "12345678909",
      "whatsapp": "11999998888",
      "email": "bianca@example.com",
      "relacionamento": {
        "tipo": "MAE",
        "responsavelLegal": true,
        "financeiro": true,
        "financeiroPrincipal": true,
        "recebeComunicados": true,
        "podeBuscar": true,
        "emergencia": true,
        "emergenciaPrincipal": true
      }
    }
  ],
  "matricula": {
    "dataMatricula": "2026-06-29",
    "statusInicial": "PENDENTE",
    "modalidadeIds": ["mod_futsal"],
    "unidadeIds": ["und_matriz"]
  },
  "metadata": {
    "schemaVersion": "2.0",
    "submittedAt": "2026-06-29T09:30:00.000Z"
  }
}
```

Segundo cadastro usa `personId` retornado no primeiro cadastro ou o mesmo CPF.

```json
{
  "aluno": {
    "nome": "Lucas Souza",
    "sexo": "MASCULINO",
    "dataNascimento": "2016-11-05"
  },
  "responsaveis": [
    {
      "personId": "per_resp_bianca",
      "nome": "Bianca Souza",
      "cpf": "12345678909",
      "whatsapp": "11999998888",
      "email": "bianca@example.com",
      "relacionamento": {
        "tipo": "MAE",
        "responsavelLegal": true,
        "financeiro": true,
        "financeiroPrincipal": true,
        "recebeComunicados": true,
        "podeBuscar": true,
        "emergencia": true,
        "emergenciaPrincipal": true
      }
    }
  ],
  "matricula": {
    "dataMatricula": "2026-06-29",
    "statusInicial": "PENDENTE",
    "modalidadeIds": ["mod_futsal"],
    "unidadeIds": ["und_matriz"]
  },
  "metadata": {
    "schemaVersion": "2.0",
    "submittedAt": "2026-06-29T09:35:00.000Z"
  }
}
```

Regra esperada: o backend nao duplica `Person` de Bianca; cria apenas novo
relacionamento com o segundo aluno.

## Caso 5 - Responsavel ja existente

```json
{
  "aluno": {
    "nome": "Marina Rocha",
    "sexo": "FEMININO",
    "dataNascimento": "2014-12-01"
  },
  "responsaveis": [
    {
      "personId": "per_resp_001",
      "nome": "Renata Rocha",
      "cpf": "12345678909",
      "whatsapp": "11999998888",
      "email": "renata@example.com",
      "relacionamento": {
        "tipo": "MAE",
        "responsavelLegal": true,
        "financeiro": true,
        "financeiroPrincipal": true,
        "recebeComunicados": true,
        "podeBuscar": true,
        "emergencia": true,
        "emergenciaPrincipal": true
      }
    }
  ],
  "matricula": {
    "dataMatricula": "2026-06-29",
    "statusInicial": "PENDENTE"
  },
  "metadata": {
    "schemaVersion": "2.0",
    "submittedAt": "2026-06-29T09:40:00.000Z"
  }
}
```

## Caso 6 - Aluno sem CPF

Aluno sem CPF e permitido quando houver nome, data de nascimento e responsavel
valido.

```json
{
  "aluno": {
    "nome": "Guilherme Almeida",
    "cpf": null,
    "sexo": "MASCULINO",
    "dataNascimento": "2017-02-18"
  },
  "responsaveis": [
    {
      "nome": "Fernanda Almeida",
      "cpf": "12345678909",
      "whatsapp": "11999998888",
      "email": "fernanda@example.com",
      "relacionamento": {
        "tipo": "MAE",
        "responsavelLegal": true,
        "financeiro": true,
        "financeiroPrincipal": true,
        "recebeComunicados": true,
        "podeBuscar": true,
        "emergencia": true,
        "emergenciaPrincipal": true
      }
    }
  ],
  "matricula": {
    "dataMatricula": "2026-06-29",
    "statusInicial": "PENDENTE"
  },
  "metadata": {
    "schemaVersion": "2.0",
    "submittedAt": "2026-06-29T09:50:00.000Z"
  }
}
```

## Caso 7 - Responsavel sem CPF permitido

Permitido apenas quando nao for responsavel legal nem financeiro.

```json
{
  "aluno": {
    "nome": "Vitor Martins",
    "cpf": null,
    "sexo": "MASCULINO",
    "dataNascimento": "2015-04-25"
  },
  "responsaveis": [
    {
      "nome": "Juliana Martins",
      "cpf": "12345678909",
      "whatsapp": "11999998888",
      "email": "juliana@example.com",
      "relacionamento": {
        "tipo": "MAE",
        "responsavelLegal": true,
        "financeiro": true,
        "financeiroPrincipal": true,
        "recebeComunicados": true,
        "podeBuscar": true,
        "emergencia": true,
        "emergenciaPrincipal": true
      }
    },
    {
      "nome": "Paulo Martins",
      "cpf": null,
      "telefone": "1133334444",
      "whatsapp": "11977776666",
      "email": null,
      "relacionamento": {
        "tipo": "TIO",
        "responsavelLegal": false,
        "financeiro": false,
        "financeiroPrincipal": false,
        "recebeComunicados": false,
        "podeBuscar": true,
        "emergencia": true,
        "emergenciaPrincipal": false,
        "prioridadeContato": 2
      }
    }
  ],
  "matricula": {
    "dataMatricula": "2026-06-29",
    "statusInicial": "PENDENTE"
  },
  "metadata": {
    "schemaVersion": "2.0",
    "submittedAt": "2026-06-29T10:00:00.000Z"
  }
}
```

## 201 Created

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
  "meta": {
    "created": {
      "personAluno": true,
      "profileAluno": true,
      "enrollment": true
    },
    "reused": {
      "responsaveis": []
    }
  },
  "requestId": "req_01HYJ12CADASTROV2",
  "timestamp": "2026-06-29T09:00:00.000Z"
}
```

## 400 Validation Error

Uso: schema invalido, tipo errado, formato invalido ou campo obrigatorio
ausente.

```json
{
  "success": false,
  "message": "Dados invalidos.",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "aluno.nome",
      "message": "Informe o nome do aluno."
    },
    {
      "field": "aluno.dataNascimento",
      "message": "Informe uma data no formato YYYY-MM-DD."
    }
  ],
  "requestId": "req_01HYJ12CADASTROV2",
  "timestamp": "2026-06-29T09:00:00.000Z"
}
```

## 401 Unauthorized

Uso: token ausente, expirado ou invalido.

```json
{
  "success": false,
  "message": "Autenticacao necessaria.",
  "code": "AUTH_REQUIRED",
  "details": [
    {
      "field": "Authorization",
      "message": "Envie um token Bearer valido."
    }
  ],
  "requestId": "req_01HYJ12CADASTROV2",
  "timestamp": "2026-06-29T09:00:00.000Z"
}
```

## 403 Forbidden

Uso: usuario autenticado sem permissao.

```json
{
  "success": false,
  "message": "Voce nao tem permissao para criar cadastros.",
  "code": "FORBIDDEN",
  "details": [
    {
      "field": "permission",
      "message": "Permissao requerida: cadastros:criar."
    }
  ],
  "requestId": "req_01HYJ12CADASTROV2",
  "timestamp": "2026-06-29T09:00:00.000Z"
}
```

## 404 Not Found

Uso: `personId`, `turmaId`, `unidadeId`, `modalidadeId`, `horarioId` ou
`planoId` informado nao existe.

```json
{
  "success": false,
  "message": "Recurso informado nao foi encontrado.",
  "code": "NOT_FOUND",
  "details": [
    {
      "field": "matricula.turmaIds[0]",
      "message": "Turma tur_sub13 nao encontrada ou indisponivel."
    }
  ],
  "requestId": "req_01HYJ12CADASTROV2",
  "timestamp": "2026-06-29T09:00:00.000Z"
}
```

## 409 Conflict

Uso: conflito de unicidade, duplicidade, relacionamento ativo duplicado,
`personId`/CPF divergentes ou idempotencia.

```json
{
  "success": false,
  "message": "Conflito ao criar cadastro.",
  "code": "CONFLICT",
  "details": [
    {
      "field": "responsaveis[0].cpf",
      "message": "CPF ja vinculado a outra pessoa com dados conflitantes."
    },
    {
      "field": "Idempotency-Key",
      "message": "A mesma chave foi usada com payload diferente."
    }
  ],
  "requestId": "req_01HYJ12CADASTROV2",
  "timestamp": "2026-06-29T09:00:00.000Z"
}
```

### 409 por requisicao idempotente em andamento

Uso: clique duplo ou retry chegou enquanto a primeira requisicao ainda nao
terminou.

```json
{
  "success": false,
  "message": "Cadastro ja esta em processamento.",
  "code": "IDEMPOTENCY_IN_PROGRESS",
  "details": [
    {
      "field": "Idempotency-Key",
      "message": "A mesma chave ja possui uma requisicao em andamento."
    }
  ],
  "requestId": "req_01HYJ12CADASTROV2",
  "timestamp": "2026-06-29T09:00:00.000Z"
}
```

## 422 Unprocessable Entity

Uso: payload bem formado, mas viola regra de negocio.

```json
{
  "success": false,
  "message": "Cadastro nao atende as regras de negocio.",
  "code": "BUSINESS_RULE_ERROR",
  "details": [
    {
      "field": "responsaveis[0].relacionamento.financeiroPrincipal",
      "message": "financeiroPrincipal exige financeiro=true."
    },
    {
      "field": "responsaveis",
      "message": "Aluno menor precisa de ao menos um responsavel legal."
    }
  ],
  "requestId": "req_01HYJ12CADASTROV2",
  "timestamp": "2026-06-29T09:00:00.000Z"
}
```

## 500 Internal Server Error

Uso: erro inesperado. Nao deve expor stack trace.

```json
{
  "success": false,
  "message": "Erro interno do servidor. Consulte os logs para mais detalhes.",
  "code": "INTERNAL_ERROR",
  "requestId": "req_01HYJ12CADASTROV2",
  "timestamp": "2026-06-29T09:00:00.000Z"
}
```

## Casos de erro documentados

### CPF duplicado

Status esperado: `409 Conflict`.

Regra:

- Se CPF ja existe para uma `Person` compativel, reutilizar.
- Se CPF ja existe com nome/data/documento conflitante, bloquear.
- Se `personId` e CPF apontarem para pessoas diferentes, bloquear.

### Relacionamento duplicado

Status esperado: `409 Conflict`.

Regra:

- Nao permitir relacionamento ativo duplicado entre mesmo aluno, mesmo
  responsavel e mesmo tipo.
- Periodos de vigencia sobrepostos tambem contam como duplicidade.
- Multiplos papeis do mesmo responsavel devem ser consolidados no mesmo
  relacionamento.

### Reenvio por timeout ou clique duplo

Status esperado:

- `201 Created` logico com a mesma resposta anterior quando a primeira
  requisicao ja concluiu com sucesso e a chave/payload sao iguais.
- `409 Conflict` com `code=IDEMPOTENCY_IN_PROGRESS` quando a primeira
  requisicao ainda esta em andamento.
- `409 Conflict` quando a mesma chave for usada com payload diferente.

Regra:

- Nao criar novos registros em reenvio idempotente com mesmo payload.

### Telefone invalido

Status esperado: `400 Validation Error`.

Regra:

- Apos normalizacao, telefone/WhatsApp deve ter DDD e ao menos 10 digitos.

### Data invalida

Status esperado: `400 Validation Error`.

Regra:

- Datas devem usar `YYYY-MM-DD`.
- Data de nascimento nao pode ser futura.
- Data de matricula nao pode ser anterior a uma data minima operacional
  definida pelo backend.

### Campos obrigatorios ausentes

Status esperado: `400 Validation Error`.

Regra:

- `aluno.nome`, `aluno.dataNascimento`, `aluno.sexo`,
  `responsaveis[].nome`, `responsaveis[].relacionamento.tipo`,
  `matricula.dataMatricula`, `matricula.statusInicial` e
  `metadata.schemaVersion` sao obrigatorios.

### Permissoes inconsistentes

Status esperado: `422 Unprocessable Entity`.

Regra:

- `financeiroPrincipal=true` exige `financeiro=true`.
- `emergenciaPrincipal=true` exige `emergencia=true`.
- Responsavel legal/financeiro exige CPF valido.
- Aluno menor exige responsavel legal.

### IDs inexistentes

Status esperado: `404 Not Found`.

Regra:

- IDs externos enviados no payload devem existir e estar ativos.

### Erro inesperado

Status esperado: `500 Internal Server Error`.

Regra:

- Retornar mensagem segura.
- Logar stack, requestId e contexto no backend.
- Executar `ROLLBACK` antes de responder.
