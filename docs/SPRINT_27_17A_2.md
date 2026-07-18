# Sprint 27.17A.2 — Contrato Canônico de Normalização de Identidade

## Resultado

Foi criado um contrato puro, determinístico e aditivo para normalizar CPF, e-mail, telefone e celular do modelo moderno de Pessoa. O contrato não consulta banco, não resolve Pessoa, não deduplica, não presume unicidade e não foi conectado aos fluxos de persistência existentes.

## Baseline

- Branch: `sprint-23`.
- Commit base: `0f414a34da568bfddcc193fdeb2b2b3568ffcd15`.
- Worktree inicial: limpo.
- A Sprint 27.17A.1 já estava incorporada ao commit base.

## Auditoria renovada

Foram revistos:

- `person.mapper.js`, `person.validator.js`, `person.service.js`, `person.repository.js` e application services de Pessoas;
- migration `20260712183000_create_people_domain_tables.sql` e SQL espelhado do domínio;
- normalizações em CRM, serviços de usuários/portal/financeiro, controllers de aluno, matrícula pública e responsáveis;
- convenções CommonJS, `node:test`, exports do domínio e `AppError`;
- testes do domínio Pessoas, Alunos, Matrículas e CRM;
- scripts reais de typecheck, build, lint e suítes CI.

Não foi encontrada validação oficial reutilizável dos dígitos verificadores de CPF. Foram encontradas várias normalizações locais de e-mail e uma normalização de telefone específica do CRM, que remove todos os não dígitos e exige 10–15 dígitos. Esse contrato do CRM não foi promovido a regra de Pessoa porque remove o `+` internacional e pressupõe limites que não estão estabelecidos para `people.telefone/celular`.

## Localização e API pública

Localização canônica: `backend/src/domains/pessoas/person-identity-normalizer.js`, ao lado das primitivas de domínio de Pessoa. O módulo é CommonJS e também é exposto de modo aditivo por `backend/src/domains/pessoas/index.js`.

API:

```javascript
const {
  normalizeCpf,
  normalizeEmail,
  normalizePhone,
  normalizeOptionalIdentityValue,
  normalizePersonIdentityInput,
} = require("./person-identity-normalizer.js");
```

A agregadora aceita apenas objeto e retorna um novo objeto congelado com os campos reais `cpf`, `email`, `telefone` e `celular`. Campos desconhecidos são ignorados. O objeto recebido não é mutado.

## Contrato comum

- `undefined`, `null`, string vazia e string apenas com espaços resultam em `null`.
- Tipos diferentes de string são rejeitados; não há coerção por `String(value)`.
- Limites são verificados no valor bruto, antes de regex ou transformação.
- Nenhuma função registra entrada, acessa banco, filesystem, HTTP ou estado global mutável.
- Nome, nascimento, sexo e endereço não participam da identidade.

## CPF

- Limite de entrada: 20 caracteres, compatível com `people.cpf VARCHAR(20)`.
- Aceita 11 dígitos ou máscara composta apenas por dígitos, ponto, hífen e espaços.
- Retorna exatamente 11 dígitos e preserva zeros à esquerda.
- Rejeita letras, caracteres inesperados, menos/mais de 11 dígitos e overflow.
- Não trunca, não completa zeros e não confunde CNPJ com CPF.
- A validação é somente sintática. Dígitos verificadores não são avaliados nesta Sprint.

## E-mail

- Limite bruto: 191 caracteres, compatível com `people.email VARCHAR(191)`.
- Aplica `trim` e lowercase.
- Exige formato sintático mínimo `local@domínio.sufixo`.
- Rejeita whitespace interno, quebras de linha e controles ASCII.
- Preserva pontos e `+alias`; não corrige domínio nem aplica regra de provedor.
- Continua sendo contato compartilhável, sem qualquer promessa de unicidade.

## Telefone e celular

- Limite bruto: 50 caracteres, compatível com ambas as colunas de `people`.
- Remove somente espaços, parênteses, ponto e hífen de apresentação.
- Preserva `+` quando ele é o primeiro caractere, mantendo DDI informado.
- Não adiciona DDI/DDD, não completa número, não trunca e não presume E.164.
- Rejeita letras, barra, `+` fora do início, ramal textual e outros caracteres inesperados.
- Não impõe quantidade mínima de dígitos: o repositório contém formatos nacionais/internacionais divergentes e rejeitar números curtos exigiria regra oficial. Essa é uma normalização sintática mínima, não uma validação semântica de telefone.
- Telefone e celular continuam compartilháveis e não exclusivos.

## Erros e PII

`PersonIdentityNormalizationError` reutiliza `AppError` e retorna somente mensagem genérica, código e `{ field }`. Códigos:

- `PERSON_IDENTITY_VALUE_INVALID`;
- `PERSON_IDENTITY_VALUE_TOO_LONG`;
- `PERSON_CPF_INVALID`;
- `PERSON_EMAIL_INVALID`;
- `PERSON_PHONE_INVALID`.

O valor recebido nunca é incluído na mensagem, detalhes ou logs. O normalizador não mascara nem faz hash: ele simplesmente não produz efeitos de log.

## Separação de responsabilidades

- **Normalização implementada:** forma canônica determinística.
- **Sintaxe mínima implementada:** caracteres/estrutura necessários para evitar transformação ambígua.
- **Semântica não implementada:** CPF oficial, existência/posse de e-mail ou validade telefônica.
- **Resolução não implementada:** nenhuma consulta, match, escolha, merge ou deduplicação.

## Compatibilidade e mapper

O mapper **não foi integrado** ao novo normalizador. Hoje ele converte tipos por `String`, trunca silenciosamente e aceita CPF/e-mail/telefone fora do novo contrato. Substituí-lo agora alteraria payloads persistidos e poderia rejeitar cadastros que atualmente passam. A Sprint escolheu o caminho aditivo: API disponível para adoção futura e explícita, sem mudança funcional nos consumidores atuais.

Consumidores ainda não migrados incluem mapper/repository de Pessoa, services de matrícula moderna, alunos e responsáveis legados, matrícula pública, pré-matrícula, CRM, serviços de usuários/portal/financeiro, fixtures, frontend e APIs.

## Ausências deliberadas

Nenhuma migration, coluna, índice, backfill, saneamento, alteração em `findByCpf`, controller, rota, CRM ou frontend foi criada. Não existe unicidade nova nem lock distribuído.

## Testes

`person-identity-normalizer.test.js` cobre ausências, tipos inválidos, limites, máscaras, zeros à esquerda, CPF sintático, lowercase/alias de e-mail, controles, telefone nacional/internacional, DDI preservado, ausência de DDI automático, overflow, pureza, determinismo, imutabilidade, campos desconhecidos e não exposição de PII.

## Limitações e riscos residuais

- CPF sintaticamente correto pode ser semanticamente inválido.
- Telefone curto pode ser normalizado porque não há regra global oficial.
- `+` preservado diferencia uma representação internacional explícita da nacional.
- Consumidores atuais continuam produzindo formatos divergentes até migração gradual.
- O contrato não torna o schema idempotente nem impede duplicidades concorrentes.

## Próximos passos

1. Sprint 27.17A.3 — diagnóstico e saneamento controlado usando este contrato sem alterar valores automaticamente.
2. Sprint 27.17A.4 — colunas normalizadas, backfill aprovado e garantias físicas seguras.
3. Sprint 27.17A.5 — serviço público idempotente de resolução.
4. Sprint 27.17B — perfil e aluno idempotentes.
5. Sprints 27.17C/D — contrato de conversão e conversão segura do Lead.

## Sugestão de commit

`feat(pessoas): adiciona contrato canonico de normalizacao`
