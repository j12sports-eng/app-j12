# Person Profile Architecture

Consolidacao de Person, Profile, Relationship, Enrollment, Contracts,
Documents e Financial.

## Principio Central

`Person` e identidade. `Profile` e papel. `Contract` e acordo. Nenhum dominio
deve duplicar dados pessoais como fonte primaria.

## Modelo

```text
Person
  -> PersonProfile
       -> AlunoProfile
       -> ResponsavelProfile
       -> ProfessorProfile
       -> LocatarioProfile
       -> FuncionarioProfile
       -> PrestadorProfile
  -> Relationships
  -> Documents
  -> Contracts via Profiles
```

## Perfis e Contratos

| Perfil | Contratos Possiveis |
| --- | --- |
| `AlunoProfile` | Matricula/prestacao de servicos. |
| `ResponsavelProfile` | Assina ou responde financeiramente por contrato de aluno. |
| `ProfessorProfile` | Prestacao de servico, parceria ou trabalho. |
| `LocatarioProfile` | Locacao de quadra, eventos, pacotes. |
| `FuncionarioProfile` | Trabalho, confidencialidade, politicas internas. |
| `PrestadorProfile` | Prestacao de servico, fornecimento, manutencao. |

## Contratos Simultaneos

A arquitetura deve suportar:

- Professor tambem aluno.
- Professor tambem locatario.
- Responsavel compartilhado por irmaos.
- Pessoa com contratos em unidades diferentes.
- Pessoa com contrato ativo e contrato futuro.
- Pessoa com contrato encerrado e novo contrato posterior.

## Relationships

Relacionamentos definem contexto entre pessoas/perfis:

- Responsavel legal por aluno.
- Responsavel financeiro por aluno.
- Autorizado a buscar aluno.
- Contato de emergencia.
- Representante de empresa locataria.
- Gestor/aprovador interno.

Contratos podem referenciar relacionamento quando a responsabilidade depende do
vinculo, como no caso de aluno menor.

## Enrollment

`Enrollment` representa matricula/jornada operacional do aluno. O contrato de
aluno deve:

- Apontar para `AlunoProfile`.
- Relacionar-se a `Enrollment`.
- Usar responsavel legal/financeiro do relacionamento.
- Gerar ou apontar para `PaymentPlan`.

## Documents

Documentos podem pertencer a:

- `Person`: RG, CPF, endereco.
- `Profile`: documentos profissionais, atestado, dados trabalhistas.
- `Contract`: anexos, assinatura, distrato.

## Financial

Financeiro deve apontar para:

- Contrato e versao de origem.
- Plano financeiro.
- Pagador/responsavel financeiro.
- Pessoa/perfil beneficiado.

## LGPD

Regras:

- Minimizar dados duplicados.
- Controlar acesso por perfil e permissao.
- Preservar base legal para contrato e obrigacoes legais.
- Permitir retencao historica quando houver obrigacao contratual/fiscal.
- Evitar exposicao ampla de documentos sensiveis.

