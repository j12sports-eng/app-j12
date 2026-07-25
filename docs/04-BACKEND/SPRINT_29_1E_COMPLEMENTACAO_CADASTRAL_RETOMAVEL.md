# Sprint 29.1E — Complementação cadastral retomável

## Resultado da auditoria

A escrita pública permanece bloqueada nesta entrega. O schema moderno não
permite identificar de forma inequívoca o responsável autorizado por um
`Enrollment`:

- `enrollments` armazena somente `student_person_id` e `student_profile_id`;
- o responsável é criado/recuperado em `people` e `person_profiles`;
- o vínculo responsável–aluno fica em `person_relationships`;
- o identificador desse relacionamento não é persistido no `Enrollment`.

Também não existe persistência canônica de progresso digital no Enrollment:

- não há `metadata`, `revision` ou estrutura dedicada;
- `updated_at` sozinho não oferece revisão incremental por formulário;
- repositories de Pessoa/Profile/Relationship usam atualização completa;
- não há transação moderna que combine patches de Pessoa com progresso.

Escolher um relacionamento por prioridade, tipo ou ordem seria uma inferência
insegura e poderia conceder acesso a dados da pessoa errada.

## Foundation entregue

`DigitalEnrollmentFormApplicationService` define as operações planejadas e
falha fechada quando o gateway agregado canônico não está disponível. Cada
operação revalida o convite antes de consultar esse gateway. A foundation:

- não está montada em HTTP;
- não grava dados;
- não altera o Enrollment;
- não marca convite como `USED`;
- não registra token ou PII;
- descarta IDs e campos de mass assignment do envelope público.

## Campos tecnicamente existentes

`people` suporta nome, CPF, RG, sexo, nascimento, e-mail, telefone, celular e
endereço. Para uma futura rota pública, a allowlist recomendada é:

- responsável: nome, e-mail e telefone; CPF apenas quando ausente e após
  política explícita;
- aluno: nome e data de nascimento;
- endereço: CEP, logradouro, número, complemento, bairro, cidade e estado.

Escola e série não existem no modelo moderno auditado e não devem ser
persistidas em tabela legada ou JSON improvisado.

## Desbloqueio necessário

Antes de montar endpoints editáveis:

1. definir vínculo canônico do responsável autorizado ao Enrollment;
2. aprovar persistência de progresso sem PII, com `revision`;
3. criar migration compatível com MySQL 5.7/8.0, sem executá-la diretamente;
4. criar patches allowlisted para `people`;
5. criar transação única para Pessoa + progresso;
6. implementar comparação otimista e conflito por `affectedRows = 0`;
7. implementar gateway agregado MySQL e in-memory;
8. somente então montar os endpoints e evoluir o frontend.

Nenhum endpoint legado, documento, contrato, financeiro, turma, agenda ou
ativação faz parte desta foundation.
