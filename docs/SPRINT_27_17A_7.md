# Sprint 27.17A.7 — Integração da Resolução Canônica com Perfil e Aluno

## Arquitetura encontrada

O projeto possui o Modelo C: há legado paralelo em `j12_alunos`, enquanto o modelo moderno canônico dentro de Pessoas é:

```text
Pessoa → person_profiles(profile_type = aluno)
```

Não existe entidade ou repository moderno Student separado. `AlunoProfile` documenta o papel, mas a persistência moderna disponível é `person_profiles`. Por isso o resultado não inventa `studentId` nem cria uma terceira entidade.

## Auditoria

Foram auditados `PersonApplicationService`, `ProfileApplicationService`, `StudentApplicationService`, resolvedor A.5, relacionamento, entidades e mappers de perfil, repositories, interfaces, SQL canônico, migrations, índices, constraints, exports, testes, consumidores modernos e tabelas legadas.

`person_profiles` possui índices simples por pessoa e tipo, sem constraint única composta, lock, compare-and-set ou transação que garanta unicidade concorrente.

## Estratégia e fluxo

A nova operação `StudentApplicationService.resolveOrCreateStudent(input, context)`:

1. valida os dados mínimos quando não há `personId` explícito;
2. delega Pessoa exclusivamente a `resolveOrCreatePerson()`;
3. delega Perfil a `resolveOrCreateStudentProfile()`;
4. retorna somente `personId`, `personProfileId`, estados de criação/reutilização e flags `reused`.

`ProfileApplicationService` consulta até dois perfis por `personId + aluno`: um é `FOUND`, nenhum é criado e múltiplos geram `STUDENT_PROFILE_CONFLICT`. Falha de criação é sanitizada como `PROFILE_CREATION_FAILED`.

## Estados e regras

- Pessoa encontrada é reutilizada sem atualização ou merge.
- Pessoa ausente é criada pelo boundary A.6.
- Conflito de Pessoa interrompe antes do Perfil.
- Perfil encontrado é reutilizado sem atualização.
- Perfil ausente é criado explicitamente.
- Perfis duplicados bloqueiam seleção arbitrária.
- Não existe etapa separada de entidade Aluno no modelo moderno.

Sem `personId`, são obrigatórios nome, data de nascimento e sexo. Nenhum valor é inventado. Com `personId` explícito, o Perfil pode ser resolvido sem replicar dados cadastrais. CPF ausente continua permitido conforme a política; CPF inválido é rejeitado pelo boundary canônico de Pessoa. E-mail e telefone são somente contatos.

## Compatibilidade

`resolveStudentPerson()`, `createStudentProfile()` e `createPerson()` foram preservados para consumidores atuais. Matrícula continua usando o fluxo anterior e não foi migrada nesta Sprint. Nenhum repository é acessado diretamente pelo novo consumidor: Student usa application services, e Profile mantém a persistência encapsulada.

Relacionamentos com responsável não são necessários para criar o Perfil moderno e não foram fabricados. Identidade continua separada de autorização; o contexto é repassado ao boundary de Pessoa sem conceder acesso, vínculo de unidade ou permissão.

## Idempotência e concorrência

Chamadas sequenciais reutilizam Pessoa e Perfil já encontrados: essa é idempotência lógica sequencial. Não há unicidade física concorrente. Duas chamadas simultâneas ainda podem observar ausência e criar perfis duplicados até futura garantia física. Não foram adicionados mutex, lock, `GET_LOCK`, índice, trigger ou infraestrutura.

## Escopo preservado e riscos

Não foram alterados Matrícula, CRM, Pré-matrícula, Financeiro, legado `j12_alunos`, controllers, rotas, frontend, API ou relacionamentos. Não houve migration, schema, índice `UNIQUE` ou validação MySQL.

O risco residual é corrida entre leitura e criação de Pessoa/Perfil. Duplicidades existentes ou concorrentes são detectadas nas chamadas posteriores e bloqueadas para revisão assistida.

As Sprints 27.17A.4.1C.1, 27.17A.4.1E e 27.17A.4.2 permanecem encerradas por bloqueio externo.

## Próximos passos

Avaliar em Sprint própria a integração com Matrículas e, depois, CRM. Qualquer garantia concorrente física continua dependente da infraestrutura suspensa.
