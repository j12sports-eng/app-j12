# Auditoria do Modelo de Identidade de Pessoa

## 1. Escopo e método

Este relatório distingue:

- **Confirmado:** comportamento ou estrutura presente no repositório no commit auditado.
- **Não comprovado:** regra de negócio, dado de produção ou schema vivo sem evidência suficiente.
- **Proposto:** desenho futuro; não implementado nesta Sprint.

Foram auditados o domínio `backend/src/domains/pessoas`, migration de fundação, mappers, validators, services, repositories, SQL direto, matrícula moderna e legada, responsáveis, pré-matrícula, CRM, autenticação, BI, fixtures, testes e documentação arquitetural. A busca não encontrou importador CSV/XLSX que grave `people`. Integrações financeiras e portais consomem identidades já existentes, sem resolver Pessoa.

## 2. Modelo moderno confirmado

### 2.1 Tabela `people`

Fonte: `backend/src/database/migrations/20260712183000_create_people_domain_tables.sql`, replicada em `people.sql` e `person.repository.js`.

| Coluna | SQL / nulabilidade / padrão | Índice ou FK | Tratamento atual | Classificação |
| --- | --- | --- | --- | --- |
| `id` | `VARCHAR(64) NOT NULL` | PK única | UUID aleatório ou id fornecido, depois `trim` | identificador técnico forte |
| `nome` | `VARCHAR(191) NOT NULL` | `idx_people_nome` comum | `trim`, corte; único campo validado como obrigatório | apoio; inadequado isoladamente |
| `cpf` | `VARCHAR(20) NULL` | `idx_people_cpf` comum | `trim`, corte; sem dígitos, DV ou formato | forte potencial, não forte no estado atual |
| `rg` | `VARCHAR(30) NULL` | nenhum | `trim`, corte | contextual/apoio; emissor/UF ausentes |
| `sexo` | `VARCHAR(30) NULL` | nenhum | `trim`, corte | apoio; inadequado como chave |
| `data_nascimento` | `DATE NULL` | nenhum | texto limitado a 10; sem validação civil no mapper | apoio; inadequado isoladamente |
| `email` | `VARCHAR(191) NULL` | `idx_people_email` comum | `trim`, corte; sem lowercase/validação | compartilhável |
| `telefone` | `VARCHAR(50) NULL` | nenhum | `trim`, corte; sem DDI/DDD/dígitos | compartilhável |
| `celular` | `VARCHAR(50) NULL` | nenhum | `trim`, corte; sem DDI/DDD/dígitos | compartilhável |
| endereço | colunas opcionais | nenhum | `trim`, corte | atributo, não identidade |
| `ativo` | `TINYINT(1) NOT NULL DEFAULT 1` | `idx_people_ativo` comum | coerção booleana | estado |
| timestamps | `DATETIME NOT NULL`, defaults automáticos | nenhum | banco | auditoria técnica |

Não há CNPJ, nome social persistido, documento alternativo tipado, identificador externo, unidade, organização ou tenant em `people`. `person.types.js` menciona `socialName`, `country` e documentos genéricos, mas o mapper/schema não os persiste; são contrato arquitetural, não colunas reais.

### 2.2 Perfis e escopo

`person_profiles` possui `id` PK, `person_id`, `profile_type`, `status` e timestamps. Há índices comuns separados, mas não FK para `people` e não há `UNIQUE(person_id, profile_type)`. Portanto:

- uma Pessoa pode possuir vários perfis e tipos (`aluno`, `responsavel`, além dos tipos modelados);
- o desenho confirma Pessoa base + papéis, não entidades civis separadas;
- duplicação do mesmo tipo de perfil para a mesma Pessoa é fisicamente possível;
- unidade/tenant não pertence a Pessoa nem ao perfil moderno. A identidade moderna é tecnicamente global pelo `people.id`, mas o escopo de unicidade dos identificadores de negócio não está definido.

### 2.3 Pessoas jurídicas

Não há `person_type`, razão social, nome fantasia ou CNPJ em `people`. Logo, pessoa jurídica na tabela moderna **não está modelada nem comprovada**. Não se deve sobrecarregar CPF ou nome para representá-la.

## 3. Normalização e validação atuais

`person.mapper.js` executa apenas conversão para string, `trim`, corte pelo tamanho e vazio para `NULL`. Não remove máscara de CPF/RG, não valida dígitos verificadores, não aplica lowercase em e-mail e não converte telefone para E.164 ou apenas dígitos.

`person.validator.js` aceita qualquer payload (`valid: true`). `PersonService.validatePersonPayload()` exige apenas nome. O ponto realmente usado pelo fluxo moderno, `PersonApplicationService.createPerson()`, delega diretamente ao repository e não usa nenhum desses validators.

Divergências confirmadas:

- CRM normaliza e-mail para lowercase e telefone para dígitos (`lead.js`), mas `people` não faz o mesmo.
- responsáveis legados e alunos legados usam apenas `trim`/corte.
- buscas `findByCpf`, filtro de CPF e filtro de e-mail fazem igualdade exata; o e-mail depende da collation case-insensitive, mas espaços/máscaras permanecem distintos.
- documentos no formato arquitetural viram apenas CPF/RG; tipos adicionais são descartados na persistência.

## 4. Localização de Pessoa

| Operação | Resultado | Normalização | Escopo | Risco |
| --- | --- | --- | --- | --- |
| `PersonRepository.findById` | zero ou um por PK | nenhuma além do parâmetro original | global | baixo para id técnico |
| `findByCpf` | zero ou um | nenhuma | global | `ORDER BY created_at DESC, id DESC LIMIT 1` oculta duplicados e escolhe arbitrariamente o mais novo |
| `list({cpf,email})` | vários | `trim` | global | não denuncia ambiguidade |
| `list({search})` | vários | `trim`, `LIKE` em nome/CPF/e-mail | global | pesquisa textual, não resolução |
| alunos/responsáveis legados | por id ou listagem | em geral `trim` | tabelas legadas | não consulta `people` |

Não existem `findByEmail` ou `findByPhone` públicos. `PersonApplicationService` expõe somente `createPerson`; o CRM não pode consumir lookup sem atravessar a fronteira do repository.

## 5. Fluxos de criação e duplicidade

| Fluxo | Persistência | Consulta prévia / transação | Repetição e corrida |
| --- | --- | --- | --- |
| `PersonService.create` | `people` via repository | valida nome; sem lookup; sem transação exposta | sempre pode criar nova Pessoa |
| `PersonApplicationService.createPerson` | `people` | nenhuma validação/lookup | sempre pode criar nova Pessoa |
| matrícula moderna `EnrollmentApplicationService` | cria responsável em `people`, perfil; cria/reusa aluno só se `aluno.personId` explícito; depois perfil/relacionamento/matrícula | services não compartilham unit of work; matrícula DRAFT tem proteção própria | responsável é recriado; aluno sem id é recriado; falha intermediária deixa Pessoa/perfil parcial |
| `StudentApplicationService.resolveStudentPerson` | `people` + perfil aluno | exige nome/dataNascimento/sexo somente se não houver personId; não verifica se id existe | id explícito é confiado; perfil é sempre inserido e pode duplicar |
| cadastro admin de aluno | `j12_alunos` e tabelas auxiliares | transação local; UPSERT apenas pelo id técnico gerado/fornecido | novo id repete a pessoa civil; ignora `people` |
| cadastro completo | mesmo fluxo legado + usuário/financeiro | transação apenas na persistência do aluno; sincronizações posteriores | parcial entre aluno, auth e financeiro; ignora `people` |
| responsáveis (duas rotas legadas) | `j12_responsaveis` | sem busca por CPF/e-mail/telefone | toda repetição cria responsável |
| matrícula pública | fluxo legado controlado pelos controllers atuais | não estabelece identidade canônica moderna | pode duplicar cadastro civil legado |
| pré-matrícula | `pre_matriculas` | validator próprio; CPF/contatos do responsável obrigatórios | workflow de aprovação é explicitamente não executável; não cria Pessoa hoje |
| fixture E2E | SQL direto em `people` e `person_profiles` | ids estáveis/`ON DUPLICATE KEY` no perfil por PK | ignora serviços; não prova identidade de produção |
| CRM | `crm_leads`, com `person_id` opcional | contato normalizado no Lead | conversão bloqueada; nenhum criador de Pessoa implementado |

Não foi encontrado controller público específico de Pessoa moderna. O use case moderno de enrollment é o orquestrador canônico pretendido, mas os endpoints administrativos legados o ignoram. Assim, não existe um único ponto canônico de criação em operação.

## 6. Concorrência e garantias físicas

Em PM2/múltiplas instâncias, duas requisições podem executar lookup (quando houver), não encontrar e inserir duas linhas, pois não há unique index por identificador normalizado, lock por chave nem tratamento de `ER_DUP_ENTRY` com releitura.

Uma transação isolada no fluxo não corrige isso sob concorrência. Locks de linha não existem quando a linha ainda não existe; lock distribuído por CPF bruto também diverge entre máscaras. Hoje, nenhum identificador de negócio oferece lock distribuído seguro. O `id` técnico bloqueia apenas a mesma linha conhecida, não duas tentativas da mesma Pessoa.

A matrícula DRAFT possui idempotência própria, mas ela começa depois que `studentPersonId` e `studentProfileId` já foram produzidos; não protege Pessoa ou Perfil.

## 7. Índices confirmados

| Tabela | Índice | Colunas | Único | Finalidade / observação |
| --- | --- | --- | --- | --- |
| `people` | `PRIMARY` | `id` | sim | identidade técnica |
| `people` | `idx_people_nome` | `nome` | não | busca textual/ordenação |
| `people` | `idx_people_cpf` | `cpf` | não | igualdade bruta; duplicidade permitida |
| `people` | `idx_people_email` | `email` | não | igualdade bruta; compartilhamento permitido |
| `people` | `idx_people_ativo` | `ativo` | não | baixa seletividade esperada; filtro operacional |
| `person_profiles` | `PRIMARY` | `id` | sim | identidade técnica do perfil |
| `person_profiles` | índices separados | `person_id`, `profile_type`, `status` | não | não substituem índice composto de idempotência |
| `pre_matriculas` | `idx_pre_matriculas_responsavel_cpf` | CPF bruto | não | consulta; não garante identidade |

Não há índice em telefone/celular. O repositório não comprova o schema vivo: `CREATE TABLE IF NOT EXISTS` não corrige drift de tabela preexistente. `SHOW CREATE TABLE` e `SHOW INDEX` permanecem gates operacionais.

## 8. Classificação e respostas objetivas

1. **CPF é único atualmente?** Não. É nullable, não normalizado e tem índice não único.
2. **CPF é obrigatório?** Não em `people`; apenas o CPF do responsável é obrigatório em `pre_matriculas`.
3. **Há PJ em `people`?** Não comprovado/modelado.
4. **E-mail pode ser compartilhado?** Sim; arquitetura cita responsável compartilhado por irmãos e não há unicidade. Trate como contato.
5. **Telefone pode ser compartilhado?** Sim; mesma conclusão.
6. **Pessoa é global ou por unidade?** `people` não possui unidade/tenant; o registro é global. A regra de negócio de CPF global ainda requer aprovação oficial.
7. **Múltiplos perfis?** Sim, estruturalmente; inclusive perfis duplicados do mesmo tipo são possíveis hoje.
8. **Pessoa/aluno/responsável?** No modelo moderno são Pessoa + perfis; no legado ainda são tabelas/registros separados.
9. **Ponto canônico de criação?** Pretendido: `PersonApplicationService`; real: há múltiplos pontos e SQL legado.
10. **Fluxos ignoram o serviço?** Sim: alunos, responsáveis e fixture.
11. **Consultas diretas a `people`?** Repository, BI/enrollment por join e fixture por insert; não foram encontradas rotas legadas consultando-a para identidade.
12. **Duplicidade possível?** Sim, de Pessoas e perfis.
13. **Duplicidade existente?** Não comprovada sem executar diagnóstico no banco; riscos já constam na Sprint 27.17.
14. **Garantia física futura?** Unique sobre identificador forte canônico, após backfill/saneamento; ou tabela de identificadores com escopo explícito.
15. **Lock seguro?** Somente hash/tipo/escopo de identificador já normalizado segundo contrato oficial; hoje nenhum.
16. **Resolver sem migration?** Não com idempotência concorrente comprovável.
17. **Migration necessária?** Aditiva: estrutura normalizada/identificadores, backfill observável, depois constraint; nunca unique direto sobre dados brutos.
18. **CRM sem repository?** Futuramente sim, por serviço público; atualmente não.
19. **Dados na conversão?** Papel do contato, dados do aluno (nome, nascimento e sexo conforme contrato atual), CPF/documento quando disponível e permitido, unidade/contexto e `startDate`; não inferir contato como aluno.
20. **Risco de e-mail/telefone como chave?** Compartilhamento familiar, reciclagem, ausência de verificação, variação de formato e vinculação ao indivíduo errado.

## 9. Qualidade de dados e PII

Não houve acesso a banco vivo. O script `docs/SQL/PESSOAS_IDENTITY_AUDIT.sql` entrega contagens, classificações e grupos por hash SHA-256; não retorna CPF, e-mail ou telefone integrais. Ele cobre nulos/vazios, formatos, diferenças de máscara/caixa/espaço e duplicidades normalizadas. IDs individuais não são retornados.

## 10. Proposta futura (não implementada)

### Modelo mínimo seguro

1. Aprovar contrato puro e versionado: CPF em 11 dígitos com validação de DV; e-mail `trim + lowercase`; telefone em formato acordado com DDI/DDD, preservando o valor original quando necessário.
2. Executar diagnóstico e classificar conflitos sem merge automático.
3. Adicionar armazenamento normalizado de modo nullable e compatível; backfill em lotes, com métricas e rollback.
4. Garantir unicidade somente do CPF válido e normalizado, se a regra oficial confirmar escopo global. E-mail/telefone permanecem não únicos.
5. Adicionar unicidade `(person_id, profile_type)` após sanear perfis duplicados.
6. Expor resolvedor público que retorne zero/um/conflito e trate duplicate-key com releitura.

### Modelo recomendado

Preferir `person_identifiers` para identificadores fortes/contextuais (`person_id`, `type`, `normalized_value`, `scope_type`, `scope_id`, `is_verified`, timestamps), com constraints por tipo e escopo, e tabela separada de contatos N:N ou compartilháveis para e-mail/telefone. Isso preserva histórico, verificação, múltiplos documentos e multiunidade sem transformar contato em identidade.

Colunas normalizadas em `people` são uma ponte simples e de menor custo, mas crescem mal para múltiplos documentos/escopos. Tabela de contatos separada é recomendada independentemente da opção de identificadores.

### Alternativas rejeitadas

- unique direto em CPF/e-mail/telefone brutos: pode falhar na migration e bloquear contatos familiares;
- nome + nascimento ou seleção do primeiro match: colisões e associação silenciosa;
- lock apenas em memória/PM2: não coordena processos/instâncias;
- transação sem unique/lock de chave: não impede inserções concorrentes;
- deduplicação dentro do CRM ou SQL direto: duplica regra do domínio proprietário;
- merge/delete automático de legado: risco irreversível e LGPD/auditoria;
- unique de identificador externo global sem integração/unidade: escopo incorreto.

## 11. Bloqueios e próximos passos

Bloqueiam a retomada: regra oficial de CPF e PJ, escopo multiunidade, política para CPF ausente/inválido, ownership/verificação de contatos, dados mínimos de aluno, resolução de conflitos existentes e estratégia de migração entre legado e Pessoa moderna.

Ordem: contrato de normalização → diagnóstico/saneamento → schema aditivo/constraints → serviço público idempotente → adaptação gradual dos criadores legados → conversão CRM.

## 12. Inventário principal auditado

- `backend/src/domains/pessoas/{person.entity,person.mapper,person.validator,person.service,person.repository,person.types}.js`
- services/use case/interfaces do application de Pessoas; profiles, relationships e pre-matricula
- migration `20260712183000_create_people_domain_tables.sql` e `backend/sql/schema.sql`
- controllers/rotas de alunos, aluno completo, responsáveis e matrícula pública
- repositories de enrollment/BI que fazem join com `people`
- CRM Lead/migration e `docs/SPRINT_27_17.md`
- fixtures E2E, testes de migration/runtime DDL e documentação de Pessoa/perfis
