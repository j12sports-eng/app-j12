# Sprint 29.3E — Formulário Público da Matrícula Digital

## Objetivo

Disponibilizar a entrada pública segura da Matrícula Digital por meio exclusivo do convite canônico emitido na Sprint 29.3D.

Esta entrega valida o token, confirma a disponibilidade do `Enrollment DRAFT` e retorna somente os dados públicos necessários para iniciar a jornada. Ela não implementa o preenchimento do formulário completo.

## Arquitetura

O fluxo implementado é:

`GET` → `EnrollmentDigitalPublicRouter` → `EnrollmentDigitalPublicController` → `EnrollmentPublicApplicationService` → `EnrollmentDigitalInvitationService` → repositórios canônicos de convite e Enrollment.

O controller é fino e não contém regras de negócio. O `EnrollmentPublicApplicationService` coordena o fluxo e monta o DTO público. Formato, hash, consulta, status, revogação, expiração e ownership do convite continuam centralizados no `EnrollmentDigitalInvitationService`.

Não foi criada arquitetura paralela. O fluxo reutiliza `MySqlEnrollmentDigitalInvitationRepository`, `MySqlEnrollmentRepository` e suas alternativas in-memory nos testes.

## Fluxo

1. O router recebe o token opaco na URL, sem autenticação administrativa.
2. O controller encaminha somente o token ao Application Service.
3. O Application Service rejeita formatos inválidos sem consultar persistência.
4. O `EnrollmentDigitalInvitationService` calcula SHA-256, consulta o convite por hash e valida `ACTIVE`, revogação, expiração, `Enrollment DRAFT` e unidade.
5. O repositório canônico de Enrollment carrega uma projeção pública pelo par confiável `enrollmentId + unitId` resolvido do convite.
6. O Application Service verifica a consistência final do Enrollment e devolve o DTO allowlisted.

## Endpoint

- Método e caminho: `GET /matricula-digital/:token`
- Autenticação administrativa: não utilizada
- Autorização: validade do token canônico
- Body: não utilizado
- Unidade: nunca recebida de header, query, body ou parâmetro público

A rota pública anterior `/api/enrollments/digital-invitations/public/:token` não foi modificada.

## DTO público

A resposta de sucesso contém somente:

```json
{
  "student": {
    "name": "Aluno Público",
    "birthDate": "2014-05-06",
    "gender": "M"
  },
  "invitation": {
    "status": "ACTIVE",
    "expiresAt": "2026-08-05 12:00:00"
  }
}
```

Não são retornados token, hash, identificadores internos, unidade, ownership, ator, metadados administrativos ou auditoria.

## Segurança

- O token bruto nunca é pesquisado nem persistido.
- A resolução reutiliza SHA-256 e consulta parametrizada por `token_hash` do serviço e repositório canônicos.
- Convites inexistentes, inválidos, expirados, revogados ou incompatíveis recebem a mesma resposta genérica `404`.
- A projeção pública de Enrollment é restrita por `enrollment.id + enrollment.unit_id` e seleciona apenas nome, nascimento e gênero.
- O endpoint aplica `Cache-Control: no-store`, `Referrer-Policy: no-referrer` e `X-Robots-Tag: noindex`.
- Logs públicos não incluem token, hash, payload, dados pessoais ou detalhes de persistência.

## Validações

O acesso falha de forma fechada quando ocorre qualquer uma das condições abaixo:

- token ausente, malformado ou inexistente;
- convite expirado ou revogado;
- status do convite diferente de `ACTIVE`;
- Enrollment inexistente;
- Enrollment diferente de `DRAFT`;
- unidade do Enrollment divergente da unidade persistida no convite;
- projeção pública ausente ou com ownership inconsistente.

## Testes

- Testes direcionados da Sprint 29.3E: 13 testes aprovados, nenhuma falha.
- Suíte completa de Enrollment: 611 testes aprovados, nenhuma falha.

A cobertura inclui token válido, inexistente, expirado, revogado e malformado; Enrollment inexistente; ownership inconsistente; DTO seguro; projeção SQL unit-scoped; Application Service; controller; route; headers de segurança e integração entre token, convite, Enrollment e resposta pública.

## Fora do escopo

Permanecem fora desta sprint:

- preenchimento integral ou atualização do formulário;
- contrato digital e assinatura eletrônica;
- financeiro e cobrança;
- ativação do Enrollment;
- Portal do Responsável;
- migrations ou alterações de schema;
- deploy e escrita em banco de produção.
