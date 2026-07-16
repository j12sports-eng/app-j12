# Sprint 23.13A - Identidade canônica do aluno legado

## Escopo

Esta etapa implementa somente a resolução determinística:

`Enrollment -> Person -> Profile aluno -> j12_alunos.id`.

Não cria ponte financeira, cobrança, mensalidade, pagamento, migration, tabela,
coluna ou dado. Banco Inter, BI, Browser E2E, CI, deploy e infraestrutura não
foram alterados.

## Fluxo

O `EnrollmentLegacyStudentIdentityService` recebe um Enrollment com os quatro
identificadores explícitos: Enrollment, Person, Profile e aluno legado. O
`MySqlEnrollmentLegacyStudentIdentityRepository` valida em uma única consulta:

1. Enrollment existe, não foi removido e aponta para Person/Profile informados;
2. Person existe;
3. Profile existe, pertence à Person e é do tipo `aluno`;
4. `j12_alunos.id` explícito existe.

O retorno é `{ enrollment_id, person_id, profile_id, legacy_student_id }`.
Ausência, inconsistência ou duplicidade falha de forma controlada. Não existe
fallback por nome, CPF, e-mail, matrícula ou igualdade entre IDs modernos e
legados.

## Arquivos novos

- `backend/src/domains/enrollments/application/services/enrollment-legacy-student-identity.service.js`
- `backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment-legacy-student-identity.repository.js`
- `backend/src/domains/enrollments/application/tests/enrollment-legacy-student-identity.service.test.js`
- `docs/AUDIT/SPRINT_23_13A_CANONICAL_STUDENT_IDENTITY.md`

## Testes e Git

Os resultados executados e o estado final do Git são registrados na entrega da
Sprint. Nenhuma integração externa é necessária para os testes unitários.
