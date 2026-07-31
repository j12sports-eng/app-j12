# Sprint 29.3F.2 — Persistência Pública Canônica do Formulário

## 1. Objetivo

Dar continuidade à Sprint 29.3F.1, habilitando a persistência parcial do formulário público da matrícula digital utilizando exclusivamente a infraestrutura canônica já existente.

Esta sprint **não cria um novo fluxo de matrícula**. Apenas expõe, de forma controlada, a escrita pública sobre um Enrollment já existente em estado `DRAFT`.

---

# 2. Escopo

Implementar um endpoint público canônico:

```
PATCH /matricula-digital/:token
```

capaz de persistir uma única seção do formulário por requisição.

A implementação deverá reutilizar integralmente a infraestrutura existente.

---

# 3. Componentes obrigatórios

A implementação deverá reutilizar:

- EnrollmentDigitalInvitationService
- DigitalEnrollmentFormApplicationService
- DigitalEnrollmentFormGateway
- createDigitalEnrollmentTransactionRunner
- revisão otimista
- allowlists existentes
- sanitização existente

Não será criado:

- novo Repository
- novo Gateway
- novo Transaction Runner
- novo mecanismo de token
- nova tabela
- nova migration

---

# 4. Contrato HTTP

## Método

```
PATCH /matricula-digital/:token
```

## Corpo

```json
{
  "section": "student",
  "revision": 2,
  "fields": {
    "birthCity": "São Paulo",
    "birthState": "SP",
    "nationality": "Brasileira",
    "bloodType": "O+"
  }
}
```

---

# 5. Seções permitidas

| section | operação interna |
|----------|------------------|
| responsible | updateResponsible |
| student | updateStudent |
| address | updateAddress |
| additional-information | updateAdditionalInformation |

Qualquer outro valor deverá ser rejeitado.

---

# 6. Regras obrigatórias

O endpoint deverá:

- validar token;
- resolver convite pelo fluxo canônico;
- localizar Enrollment;
- validar ownership;
- validar unidade;
- validar estado DRAFT;
- executar revisão otimista;
- executar transação canônica;
- persistir apenas a seção solicitada.

A matrícula nunca poderá mudar para ACTIVE nesta sprint.

---

# 7. Segurança

Nunca aceitar:

- unitId
- unit_id
- enrollmentId
- personId
- profileId

enviados pelo cliente.

Toda resolução continuará derivando exclusivamente do token válido.

---

# 8. Respostas

## 200

Persistência realizada com sucesso.

## 400

Payload inválido.

## 404

Token inválido.

Convite inexistente.

Enrollment inexistente.

Ownership inválido.

Estado incompatível.

A resposta deverá permanecer genérica.

## 409

Conflito de revisão otimista.

---

# 9. Fora do escopo

Esta sprint NÃO implementa:

- contrato
- assinatura
- documentos
- revisão administrativa
- turma
- ativação
- financeiro
- notificações
- frontend
- portal
- deploy
- migrations

---

# 10. Testes obrigatórios

## Rota

- PATCH disponível
- GET continua funcionando

## Controller

- encaminha corretamente token
- encaminha section
- encaminha revision
- encaminha fields

## Application Service

- aceita apenas as quatro seções
- rejeita seção desconhecida
- reutiliza validação existente

## Integração

- mantém Enrollment em DRAFT
- falha para token inválido
- falha para convite expirado
- falha para ownership inválido
- falha para revisão incompatível
- rollback transacional funcionando

---

# 11. Critérios de aceite

A sprint será considerada concluída quando:

- existir PATCH /matricula-digital/:token;
- utilizar apenas componentes canônicos existentes;
- nenhuma migration nova for criada;
- nenhuma infraestrutura paralela for criada;
- Enrollment permanecer DRAFT;
- testes passarem;
- não houver regressão do GET público.

---

# 12. Restrições

Durante esta sprint:

- não executar git add;
- não executar git commit;
- não executar git push;
- não executar migrations;
- não executar deploy.

Todo desenvolvimento deverá ocorrer apenas no workspace local.