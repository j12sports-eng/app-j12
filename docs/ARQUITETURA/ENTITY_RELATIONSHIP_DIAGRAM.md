# Entity Relationship Diagram

Diagrama textual da arquitetura alvo para contratos.

## Diagrama Principal

```text
Person
  |
  +-- PersonProfile
  |     |
  |     +-- AlunoProfile
  |     +-- ResponsavelProfile
  |     +-- ProfessorProfile
  |     +-- LocatarioProfile
  |     +-- FuncionarioProfile
  |     +-- PrestadorProfile
  |
  +-- PersonRelationship
  |
  +-- Document
  |
  +-- Contracts
        |
        +-- ContractType
        +-- ContractStatus
        +-- ContractVersion
        |     |
        |     +-- ContractTerm
        |     +-- ContractSignature
        |
        +-- ContractAttachment
        +-- ContractHistory
        +-- ContractTermination
        +-- PaymentPlan
        |     |
        |     +-- Charge
        |     +-- Payment
        |     +-- Delinquency
        |
        +-- Documents
```

## Relacoes Conceituais

```text
Person 1 -> N PersonProfile
Person 1 -> N Document
PersonProfile 1 -> N Contract
Contract 1 -> N ContractVersion
Contract 1 -> N ContractSignature
Contract 1 -> N ContractAttachment
Contract 1 -> N ContractHistory
Contract 0 -> 1 ContractTermination active
Contract 0 -> N PaymentPlan
PaymentPlan 1 -> N Charge
Charge 0 -> N Payment
ContractType 1 -> N Contract
ContractType 1 -> N DocumentRequirement
```

## Aluno

```text
PersonAluno
  -> AlunoProfile
       -> Enrollment
       -> Contract(ALUNO_MATRICULA)
            -> ContractVersion
            -> ContractSignature(J12)
            -> ContractSignature(Responsavel/Aluno maior)
            -> PaymentPlan
            -> ContractAttachment(Documentos)

PersonResponsavel
  -> ResponsavelProfile
       -> Relationship(legal/financeiro/comunicados/busca)
       -> ContractSignature
```

## Professor

```text
PersonProfessor
  -> ProfessorProfile
       -> Contract(PROFESSOR_PRESTACAO_SERVICO)
            -> ContractVersion
            -> ContractSignature(Professor)
            -> PaymentPlan(contas a pagar ou repasses)
            -> Documents(certificacoes)
```

## Locatario

```text
PersonLocatario
  -> LocatarioProfile
       -> Reservation/Agenda
       -> Contract(LOCATARIO_QUADRA)
            -> ContractVersion
            -> ContractSignature(Locatario)
            -> PaymentPlan(caucao/reserva/pacote)
```

## Funcionario Futuro

```text
PersonFuncionario
  -> FuncionarioProfile
       -> UserAccess
       -> Contract(FUNCIONARIO_TRABALHO)
            -> ContractVersion
            -> ContractSignature(Funcionario)
            -> Documents(trabalhistas)
```

## Prestador Futuro

```text
PersonPrestador
  -> PrestadorProfile
       -> Contract(PRESTADOR_SERVICO)
            -> ContractVersion
            -> ContractSignature(Prestador)
            -> PaymentPlan(contas a pagar)
            -> Documents(fiscais)
```

