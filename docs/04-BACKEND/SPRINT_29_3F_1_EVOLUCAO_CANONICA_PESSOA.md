# Sprint 29.3F.1  Evolucao canonica dos dados da Pessoa

## Motivo

A Sprint 29.3F depende de persistencia parcial do formulario publico da matricula digital. A auditoria anterior confirmou que a tabela canonica people nao possuia naturalidade, nacionalidade e tipo sanguineo. Esta sprint prepara a base sem expor escrita publica.

## Campos adicionados

O contrato de dominio Person agora aceita campos opcionais e nulaveis:

| Dominio     | Persistencia | Tipo              |
| ----------- | ------------ | ----------------- |
| birthCity   | birth_city   | VARCHAR(191) NULL |
| birthState  | birth_state  | VARCHAR(50) NULL  |
| nationality | nationality  | VARCHAR(191) NULL |
| bloodType   | blood_type   | VARCHAR(20) NULL  |

Os nomes fisicos seguem snake_case para colunas novas e mantem os nomes legados em portugues que ja existem em people. Nao foi criada tabela concorrente, JSON generico ou metadata substitutiva.

## Migration

backend/src/database/migrations/20260729210000_add_people_digital_enrollment_fields.js adiciona somente as quatro colunas, depois de verificar a existencia da tabela e a compatibilidade de qualquer coluna parcialmente aplicada. Todos os campos permitem NULL, sem backfill ou valores artificiais.

O rollback remove as colunas somente quando nenhuma possui valor. Em caso de dados preenchidos, ele falha de forma segura para evitar perda. A migration foi testada com schema ausente, schema incompativel, aplicacao, rollback vazio e rollback bloqueado.

A migration nao foi aplicada em producao e nenhum banco de producao foi escrito.

## Person, mapper e repositories

Person, seus tipos JSDoc, toJSON, mapper e PersonRepository leem e persistem os quatro campos. Registros antigos retornam null. O update de PersonService continua sendo merge parcial: campos omitidos sao preservados e null explicito limpa o valor.

Nao existe um repository Memory de producao para people; os testes usam query runners/fakes em memoria, conforme a convencao existente, para validar persistencia, leitura e merge sem introduzir uma implementacao paralela.

Os DDLs de runtime (people.sql e CREATE_PEOPLE_TABLE_SQL) foram alinhados para novas instalacoes. A migration incremental continua sendo a mudanca para bancos existentes.

## DigitalEnrollmentFormGateway

O gateway existente foi estendido para reconhecer os quatro campos no passo interno updateStudent. A normalizacao e minima e segura: texto trimado e limitado ao tamanho fisico; bloodType nao recebeu enum porque nenhuma convencao canonica existente foi encontrada. undefined e ignorado para nao sobrescrever dados, enquanto null explicito e preservado como limpeza.

O contrato interno de allowlist tambem reconhece os campos. Nenhum endpoint publico, PATCH, rota, contrato, cobranca, financeiro, ativacao, assinatura, notificacao ou deploy foi criado nesta sprint.

## Compatibilidade e limitacoes

- Colunas novas sao opcionais e nulaveis.
- Nenhum campo legado foi renomeado ou removido.
- Nenhuma tabela paralela foi criada.
- A persistencia publica por token continua bloqueada ate a retomada autorizada da Sprint 29.3F.
- CPF, RG e sexo continuam nos campos legados existentes; esta sprint adiciona somente os quatro campos ausentes.

## Preparacao para a Sprint 29.3F

Com a migration aplicada em ambiente autorizado e os dados canonicos disponiveis, a proxima sprint podera reutilizar o mesmo DigitalEnrollmentFormGateway para implementar a persistencia parcial do formulario publico, mantendo validacao de token, ownership, revisao otimista e transacao canonica.
