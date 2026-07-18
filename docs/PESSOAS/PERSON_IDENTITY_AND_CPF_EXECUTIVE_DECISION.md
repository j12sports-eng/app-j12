# Aprovação Executiva — Identidade de Pessoa e CPF

## 1. Resumo Executivo

A J12 Sports precisa definir como o ERP reconhece uma pessoa ao longo de toda a sua relação com a empresa. Essa definição determina quando dois cadastros representam a mesma pessoa, quando o CPF é exigido e como tratar menores, estrangeiros, empresas, correções e registros antigos.

Enquanto essas escolhas permanecerem abertas, não é seguro ativar unicidade de CPF, automatizar a resolução de identidade, converter Leads em Pessoas e Matrículas ou deduplicar cadastros. Uma decisão incorreta pode bloquear clientes legítimos, associar dados financeiros à pessoa errada, expor informações entre unidades ou criar riscos contratuais e de LGPD.

Dependem desta aprovação: Pessoas, Alunos, Responsáveis, Professores, Matrículas, CRM, Financeiro, Locações, Portais, autenticação e operação multiunidade.

Este documento apresenta recomendações técnicas, mas não aprova nenhuma alternativa. Todas as decisões estão em `PENDING_APPROVAL` até manifestação formal da direção.

## 2. Situação Atual

### Fatos confirmados

- o ERP possui uma base moderna de Pessoa sem vínculo direto com unidade;
- CPF pode estar ausente nessa base;
- fluxos antigos ainda mantêm cadastros paralelos;
- pré-matrícula exige CPF do responsável;
- não existe modelo completo para empresas ou documentos estrangeiros;
- alteração e exclusão de Pessoa ainda não possuem política empresarial formal;
- a validação física MySQL e a auditoria dos dados operacionais ainda não foram executadas.

### Decisões técnicas aprovadas

- a identidade deve ser separada dos papéis exercidos pela pessoa;
- uma mesma pessoa pode exercer múltiplos papéis;
- identidade global não significa acesso global aos seus dados;
- e-mail e telefone podem ser compartilhados e não devem identificar uma pessoa isoladamente.

### Decisões propostas

- CPF como identificador forte opcional, exigido conforme etapa;
- bloqueio e revisão de CPF duplicado;
- rejeição de novo CPF inválido;
- preservação controlada de registros legados inválidos;
- reserva da identidade quando a pessoa fica inativa.

### Decisões bloqueadas

- fronteira entre Pessoa Física e Pessoa Jurídica;
- política de estrangeiros e documentos alternativos;
- momento obrigatório do CPF em cada jornada;
- autorização e auditoria para alterar CPF;
- retenção e exclusão física diante de obrigações legais e LGPD.

## 3. Decisões para aprovação

### DEC-01 — Escopo da entidade People

**Código:** DEC-01

**Pergunta:** People representa somente Pessoa Física?

**Contexto:** A estrutura atual contém CPF e dados pessoais, mas não possui tipo de pessoa ou CNPJ. Há demandas relacionadas a empresas em locação, patrocínio e fornecimento.

**Alternativas:**

- A — Somente Pessoa Física.
- B — Pessoa Física e Jurídica.
- C — Decisão futura, mantendo novos usos empresariais bloqueados.

**Impactos:** Define o significado central da base, os documentos aceitos e o desenho das integrações futuras.

**Riscos:** Misturar pessoas e empresas sem discriminador pode gerar unicidade incorreta e dados fiscais inconsistentes.

**Recomendação Técnica:** A — reservar People para Pessoa Física e modelar organizações separadamente.

**Campo para Aprovação:** ☐ A ☐ B ☐ C — Status: `PENDING_APPROVAL`

**Responsável:** (preencher)

**Data:** (dd/mm/aaaa)

**Observações:** (preencher)

### DEC-02 — Pessoa Jurídica

**Código:** DEC-02

**Pergunta:** Empresas possuirão domínio próprio?

**Contexto:** Fornecedores, patrocinadores, parceiros e locatários empresariais possuem dados, documentos e responsabilidades diferentes de indivíduos.

**Alternativas:**

- A — Criar futuramente domínio próprio de Organizações.
- B — Incluir empresas em People após ampliar o modelo.
- C — Não atender Pessoa Jurídica no ERP.

**Impactos:** Afeta contratos, financeiro, locações, patrocínios e representação por pessoas.

**Riscos:** Ausência de domínio claro incentiva uso indevido de CPF ou nome de representante como identidade da empresa.

**Recomendação Técnica:** A — domínio próprio, ligado às Pessoas que representam a organização.

**Campo para Aprovação:** ☐ A ☐ B ☐ C — Status: `PENDING_APPROVAL`

**Responsável:** (preencher)

**Data:** (dd/mm/aaaa)

**Observações:** (preencher)

### DEC-03 — Papel do CPF

**Código:** DEC-03

**Pergunta:** Qual é o papel oficial do CPF no cadastro?

**Contexto:** O CPF pode identificar fortemente um indivíduo quando informado corretamente, mas há jornadas legítimas que podem começar sem ele.

**Alternativas:**

- A — Identificador forte opcional.
- B — Obrigatório para toda Pessoa.
- C — Apenas atributo cadastral.
- D — Outro: **\*\***\*\*\*\***\*\***\_\_\_\_**\*\***\*\*\*\***\*\***.

**Impactos:** Define busca, prevenção de duplicidade e requisitos de onboarding.

**Riscos:** Torná-lo sempre obrigatório pode excluir menores e estrangeiros; tratá-lo apenas como atributo mantém duplicidades.

**Recomendação Técnica:** A — identificador forte opcional, sujeito a regras por etapa.

**Campo para Aprovação:** ☐ A ☐ B ☐ C ☐ D — Status: `PENDING_APPROVAL`

**Responsável:** (preencher)

**Data:** (dd/mm/aaaa)

**Observações:** (preencher)

### DEC-04 — Momento de obrigatoriedade do CPF

**Código:** DEC-04

**Pergunta:** Em qual etapa o CPF passa a ser obrigatório?

**Contexto:** Lead, pré-matrícula, Draft, matrícula Active e financeiro possuem necessidades e compromissos diferentes.

**Alternativas:**

- A — Lead: opcional; pré-matrícula: responsável obrigatório; Draft: opcional; Active e financeiro: conforme menor/estrangeiro e exigência contratual.
- B — Obrigatório a partir da pré-matrícula.
- C — Obrigatório somente antes de gerar financeiro.
- D — Regras específicas a definir por jornada.

**Impactos:** Afeta conversão comercial, ativação, contratos e cobrança.

**Riscos:** Exigência precoce reduz conversão; exigência tardia pode impedir cobrança ou documentação contratual.

**Recomendação Técnica:** A, condicionada às decisões sobre menor, adulto, responsável e estrangeiro.

**Campo para Aprovação:** ☐ A ☐ B ☐ C ☐ D — Status: `PENDING_APPROVAL`

**Responsável:** (preencher)

**Data:** (dd/mm/aaaa)

**Observações:** (preencher)

### DEC-05 — Aluno menor

**Código:** DEC-05

**Pergunta:** Aluno menor pode existir sem CPF?

**Contexto:** Crianças podem não ter CPF disponível no início, enquanto o responsável legal e financeiro sustenta a relação contratual.

**Alternativas:**

- A — Sim, com responsável identificado e pendência de documento.
- B — Não, CPF obrigatório antes de qualquer cadastro.
- C — Sim apenas até a matrícula Draft.

**Impactos:** Afeta captação, matrícula infantil e responsabilidade contratual.

**Riscos:** Bloquear pode excluir alunos legítimos; liberar sem responsável suficiente cria risco contratual.

**Recomendação Técnica:** A — permitir, usando ID interno e responsável devidamente identificado.

**Campo para Aprovação:** ☐ A ☐ B ☐ C — Status: `PENDING_APPROVAL`

**Responsável:** (preencher)

**Data:** (dd/mm/aaaa)

**Observações:** (preencher)

### DEC-06 — Aluno adulto

**Código:** DEC-06

**Pergunta:** Aluno adulto pode ativar matrícula sem CPF?

**Contexto:** A ativação gera relação contratual e pode gerar obrigações financeiras.

**Alternativas:**

- A — Não, salvo estrangeiro coberto por política específica.
- B — Sim, sem restrição.
- C — Sim, somente com aprovação administrativa e prazo de regularização.

**Impactos:** Afeta ativação, contrato, cobrança e qualidade cadastral.

**Riscos:** Ausência de documento pode dificultar cobrança e identificação; regra absoluta pode bloquear estrangeiros.

**Recomendação Técnica:** A — exigir para adulto brasileiro e tratar estrangeiro separadamente.

**Campo para Aprovação:** ☐ A ☐ B ☐ C — Status: `PENDING_APPROVAL`

**Responsável:** (preencher)

**Data:** (dd/mm/aaaa)

**Observações:** (preencher)

### DEC-07 — Responsável

**Código:** DEC-07

**Pergunta:** Quando o CPF do responsável passa a ser obrigatório?

**Contexto:** A pré-matrícula atual já exige CPF do responsável, que pode exercer responsabilidade legal, financeira ou apenas contato.

**Alternativas:**

- A — Quando assumir responsabilidade legal ou financeira.
- B — Em todo cadastro de responsável.
- C — Somente antes da primeira cobrança ou assinatura.

**Impactos:** Afeta menores, contratos, cobranças e relacionamentos familiares.

**Riscos:** Confundir contato com responsável legal amplia coleta de dados; ausência no pagador prejudica obrigações financeiras.

**Recomendação Técnica:** A — exigir conforme o papel formal assumido.

**Campo para Aprovação:** ☐ A ☐ B ☐ C — Status: `PENDING_APPROVAL`

**Responsável:** (preencher)

**Data:** (dd/mm/aaaa)

**Observações:** (preencher)

### DEC-08 — Estrangeiros

**Código:** DEC-08

**Pergunta:** Como Pessoas estrangeiras serão cadastradas?

**Contexto:** Estrangeiros podem não possuir CPF e não devem receber números fictícios.

**Alternativas:**

- A — ID interno e documento estrangeiro próprio; CPF opcional.
- B — CPF obrigatório.
- C — Cadastro excepcional manual sem documento.

**Impactos:** Afeta inclusão, contratos, identificação e conformidade documental.

**Riscos:** CPF fictício cria colisões; ausência total de documento dificulta identificação e auditoria.

**Recomendação Técnica:** A — documento alternativo e CPF opcional quando legalmente disponível.

**Campo para Aprovação:** ☐ A ☐ B ☐ C — Status: `PENDING_APPROVAL`

**Responsável:** (preencher)

**Data:** (dd/mm/aaaa)

**Observações:** (preencher)

### DEC-09 — Documento alternativo

**Código:** DEC-09

**Pergunta:** Será criado domínio específico para documentos alternativos?

**Contexto:** Passaporte, CRNM/RNE e documentos estrangeiros exigem tipo, país emissor e normalização próprios.

**Alternativas:**

- A — Criar domínio de documentos de Pessoa.
- B — Adicionar campos fixos diretamente em People.
- C — Não armazenar documento alternativo.

**Impactos:** Determina a capacidade de atender estrangeiros e novos documentos.

**Riscos:** Campos fixos escalam mal; não armazenar reduz a segurança de identificação.

**Recomendação Técnica:** A — domínio tipado de documentos, com acesso restrito.

**Campo para Aprovação:** ☐ A ☐ B ☐ C — Status: `PENDING_APPROVAL`

**Responsável:** (preencher)

**Data:** (dd/mm/aaaa)

**Observações:** (preencher)

### DEC-10 — Validação do CPF

**Código:** DEC-10

**Pergunta:** Qual nível de validação será adotado?

**Contexto:** O contrato atual reconhece apenas onze dígitos e não comprova existência ou titularidade.

**Alternativas:**

- A — Apenas 11 dígitos.
- B — 11 dígitos e dígitos verificadores.
- C — Documento verificado por processo autorizado.
- D — B para cadastro e C apenas em operações de maior risco.

**Impactos:** Afeta experiência, qualidade, fraude e custos operacionais.

**Riscos:** Validação fraca aceita erros; verificação externa generalizada aumenta custo, tratamento de dados e dependências.

**Recomendação Técnica:** D — validar dígitos no cadastro e verificar somente quando houver finalidade aprovada.

**Campo para Aprovação:** ☐ A ☐ B ☐ C ☐ D — Status: `PENDING_APPROVAL`

**Responsável:** (preencher)

**Data:** (dd/mm/aaaa)

**Observações:** (preencher)

### DEC-11 — Novo CPF inválido

**Código:** DEC-11

**Pergunta:** Como tratar novo CPF inválido?

**Contexto:** Hoje um writer moderno pode preservar o original e deixar o normalizado nulo, contornando uma futura unicidade.

**Alternativas:**

- A — Rejeitar.
- B — Permitir.
- C — Permitir e marcar para revisão.

**Impactos:** Afeta qualidade, onboarding e eficácia da unicidade.

**Riscos:** Permitir silenciosamente perpetua drift; rejeitar sem exceções pode afetar importações controladas.

**Recomendação Técnica:** A — rejeitar novos writes; importação legada deve ter processo separado.

**Campo para Aprovação:** ☐ A ☐ B ☐ C — Status: `PENDING_APPROVAL`

**Responsável:** (preencher)

**Data:** (dd/mm/aaaa)

**Observações:** (preencher)

### DEC-12 — CPF legado inválido

**Código:** DEC-12

**Pergunta:** Como tratar CPF inválido já existente?

**Contexto:** Registros antigos podem conter máscara inadequada, erro ou valor não normalizável.

**Alternativas:**

- A — Preservar, marcar para revisão e impedir uso como identidade forte.
- B — Apagar automaticamente.
- C — Corrigir automaticamente.
- D — Bloquear todo acesso ao registro.

**Impactos:** Afeta continuidade operacional, saneamento e auditoria.

**Riscos:** Apagar ou corrigir automaticamente altera dado civil sem comprovação.

**Recomendação Técnica:** A — preservar original com acesso restrito e saneamento assistido.

**Campo para Aprovação:** ☐ A ☐ B ☐ C ☐ D — Status: `PENDING_APPROVAL`

**Responsável:** (preencher)

**Data:** (dd/mm/aaaa)

**Observações:** (preencher)

### DEC-13 — CPF duplicado

**Código:** DEC-13

**Pergunta:** Qual é a política oficial quando o mesmo CPF aparece em Pessoas diferentes?

**Contexto:** O banco atual permite duplicidade; ela pode representar erro, fraude ou cadastros repetidos.

**Alternativas:**

- A — Bloquear nova criação e encaminhar para revisão.
- B — Reutilizar automaticamente o cadastro mais recente.
- C — Permitir duplicidade.
- D — Mesclar automaticamente.

**Impactos:** Afeta matrículas, financeiro, CRM e portais.

**Riscos:** Reuso ou merge automático pode associar dados e contratos à pessoa errada.

**Recomendação Técnica:** A — conflito explícito e revisão humana autorizada.

**Campo para Aprovação:** ☐ A ☐ B ☐ C ☐ D — Status: `PENDING_APPROVAL`

**Responsável:** (preencher)

**Data:** (dd/mm/aaaa)

**Observações:** (preencher)

### DEC-14 — Alteração de CPF

**Código:** DEC-14

**Pergunta:** Quem poderá alterar CPF e sob quais controles?

**Contexto:** A alteração técnica é possível, mas não há permissão específica, motivo obrigatório ou trilha de documento.

**Alternativas:**

- A — Somente função administrativa autorizada, com motivo, auditoria e verificação de conflito.
- B — Qualquer operador com edição cadastral.
- C — CPF não pode ser alterado.
- D — Apenas suporte técnico mediante processo formal.

**Impactos:** Afeta correções, fraude, atendimento e responsabilização.

**Riscos:** Alteração livre permite apropriação de identidade; proibição absoluta impede correções legítimas.

**Recomendação Técnica:** A, com permissão segregada e sem exposição do valor em logs.

**Campo para Aprovação:** ☐ A ☐ B ☐ C ☐ D — Status: `PENDING_APPROVAL`

**Responsável:** (preencher)

**Data:** (dd/mm/aaaa)

**Observações:** (preencher)

### DEC-15 — Histórico de CPF

**Código:** DEC-15

**Pergunta:** Histórico de alteração de CPF será obrigatório?

**Contexto:** Correções precisam preservar autoria, motivo e momento sem ampliar acesso ao documento.

**Alternativas:**

- A — Sim, histórico obrigatório e protegido.
- B — Registrar somente evento sem valor anterior.
- C — Não manter histórico.

**Impactos:** Afeta auditoria, investigação, LGPD e suporte.

**Riscos:** Guardar valores amplia responsabilidade de proteção; não guardar reduz rastreabilidade.

**Recomendação Técnica:** A — histórico protegido, com retenção e acesso definidos pelo jurídico/LGPD.

**Campo para Aprovação:** ☐ A ☐ B ☐ C — Status: `PENDING_APPROVAL`

**Responsável:** (preencher)

**Data:** (dd/mm/aaaa)

**Observações:** (preencher)

### DEC-16 — Pessoa inativa

**Código:** DEC-16

**Pergunta:** Pessoa inativa continua reservando sua identidade?

**Contexto:** Fim de matrícula, perfil ou contrato não significa que o indivíduo deixou de existir.

**Alternativas:**

- A — Sim, CPF permanece reservado.
- B — Não, CPF pode ser usado em nova Pessoa.
- C — Reserva por prazo determinado.

**Impactos:** Afeta retorno de clientes, histórico, contratos e duplicidade.

**Riscos:** Liberar CPF cria duas identidades para o mesmo indivíduo; retenção indefinida precisa de base legal.

**Recomendação Técnica:** A, condicionada à política jurídica de retenção.

**Campo para Aprovação:** ☐ A ☐ B ☐ C — Status: `PENDING_APPROVAL`

**Responsável:** (preencher)

**Data:** (dd/mm/aaaa)

**Observações:** (preencher)

### DEC-17 — Exclusão física

**Código:** DEC-17

**Pergunta:** Exclusão física de Pessoa será permitida?

**Contexto:** O sistema atual permite delete físico, mas Pessoas podem possuir vínculos, pagamentos e obrigações históricas.

**Alternativas:**

- A — Proibir quando houver vínculos; usar inativação/anonimização conforme política.
- B — Permitir para administradores.
- C — Permitir apenas por processo jurídico/LGPD formal.
- D — Nunca permitir.

**Impactos:** Afeta retenção, direito do titular, auditoria e integridade referencial.

**Riscos:** Exclusão pode quebrar histórico legal; retenção excessiva pode violar princípios de minimização.

**Recomendação Técnica:** A com exceção controlada C, após parecer jurídico.

**Campo para Aprovação:** ☐ A ☐ B ☐ C ☐ D — Status: `PENDING_APPROVAL`

**Responsável:** (preencher)

**Data:** (dd/mm/aaaa)

**Observações:** (preencher)

### DEC-18 — Política para cpf_normalized nulo

**Código:** DEC-18

**Pergunta:** Quando `cpf_normalized = NULL` é permitido?

**Contexto:** O valor nulo é necessário quando CPF está ausente, mas também pode ocultar CPF inválido preenchido.

**Alternativas:**

- A — Ausência: permitido; legado inválido: temporário e em revisão; novo cadastro com CPF inválido: rejeitado.
- B — Sempre permitido.
- C — Nunca permitido.
- D — Permitido apenas para menores e estrangeiros.

**Impactos:** Determina a eficácia de uma futura unicidade e o tratamento do legado.

**Riscos:** Permissão ampla cria bypass; proibição total bloqueia pessoas legitimamente sem CPF.

**Recomendação Técnica:** A.

**Campo para Aprovação:** ☐ A ☐ B ☐ C ☐ D — Status: `PENDING_APPROVAL`

**Responsável:** (preencher)

**Data:** (dd/mm/aaaa)

**Observações:** (preencher)

### DEC-19 — Escopo futuro da unicidade

**Código:** DEC-19

**Pergunta:** Qual será o escopo da unicidade de CPF?

**Contexto:** A base moderna de Pessoa é global e não possui unidade; vínculos e permissões são contextuais.

**Alternativas:**

- A — Global em todo o ERP.
- B — Por unidade.
- C — Por organização/tenant futuro.
- D — Outro: **\*\***\*\*\*\***\*\***\_\_\_\_**\*\***\*\*\*\***\*\***.

**Impactos:** Define se uma pessoa em duas unidades reutiliza a mesma identidade.

**Riscos:** Unicidade por unidade perpetua duplicidade civil; unicidade global sem autorização adequada pode expor existência entre unidades.

**Recomendação Técnica:** A — unicidade global, com resposta de conflito que não exponha dados sem autorização.

**Campo para Aprovação:** ☐ A ☐ B ☐ C ☐ D — Status: `PENDING_APPROVAL`

**Responsável:** (preencher)

**Data:** (dd/mm/aaaa)

**Observações:** (preencher)

### DEC-20 — Privacidade e autorização

**Código:** DEC-20

**Pergunta:** Resolução de identidade será separada da autorização para visualizar ou usar a Pessoa?

**Contexto:** Encontrar correspondência global não deve conceder acesso a dados de outra unidade ou perfil.

**Alternativas:**

- A — Separar resolução e autorização, com resposta sem PII quando não houver permissão.
- B — Quem puder pesquisar pode visualizar a Pessoa encontrada.
- C — Resolução somente dentro da unidade, mesmo com identidade global.

**Impactos:** Afeta portais, unidades, CRM, atendimento e LGPD.

**Riscos:** Busca global aberta expõe dados; busca apenas local permite cadastros duplicados.

**Recomendação Técnica:** A — resolução global interna e autorização contextual obrigatória.

**Campo para Aprovação:** ☐ A ☐ B ☐ C — Status: `PENDING_APPROVAL`

**Responsável:** (preencher)

**Data:** (dd/mm/aaaa)

**Observações:** (preencher)

## 4. Quadro consolidado

| Código | Decisão                   | Recomendação Técnica                               | Status             |
| ------ | ------------------------- | -------------------------------------------------- | ------------------ |
| DEC-01 | Escopo da entidade People | somente Pessoa Física                              | `PENDING_APPROVAL` |
| DEC-02 | Pessoa Jurídica           | domínio próprio de Organizações                    | `PENDING_APPROVAL` |
| DEC-03 | Papel do CPF              | identificador forte opcional                       | `PENDING_APPROVAL` |
| DEC-04 | Momento obrigatório       | exigência progressiva por jornada                  | `PENDING_APPROVAL` |
| DEC-05 | Aluno menor               | permitir sem CPF com responsável                   | `PENDING_APPROVAL` |
| DEC-06 | Aluno adulto              | exigir na ativação, salvo estrangeiro              | `PENDING_APPROVAL` |
| DEC-07 | Responsável               | exigir no papel legal/financeiro                   | `PENDING_APPROVAL` |
| DEC-08 | Estrangeiros              | documento alternativo e CPF opcional               | `PENDING_APPROVAL` |
| DEC-09 | Documento alternativo     | domínio tipado de documentos                       | `PENDING_APPROVAL` |
| DEC-10 | Validação                 | dígitos verificadores e verificação por risco      | `PENDING_APPROVAL` |
| DEC-11 | Novo CPF inválido         | rejeitar                                           | `PENDING_APPROVAL` |
| DEC-12 | CPF legado inválido       | preservar e revisar                                | `PENDING_APPROVAL` |
| DEC-13 | CPF duplicado             | bloquear e revisar                                 | `PENDING_APPROVAL` |
| DEC-14 | Alteração de CPF          | autorização segregada e auditoria                  | `PENDING_APPROVAL` |
| DEC-15 | Histórico de CPF          | obrigatório e protegido                            | `PENDING_APPROVAL` |
| DEC-16 | Pessoa inativa            | identidade continua reservada                      | `PENDING_APPROVAL` |
| DEC-17 | Exclusão física           | bloquear com vínculos; processo formal             | `PENDING_APPROVAL` |
| DEC-18 | Normalizado nulo          | ausência/legado controlado; rejeitar novo inválido | `PENDING_APPROVAL` |
| DEC-19 | Escopo da unicidade       | global com autorização contextual                  | `PENDING_APPROVAL` |
| DEC-20 | Privacidade               | resolução separada de autorização                  | `PENDING_APPROVAL` |

## 5. Formulário de Aprovação

Este formulário não substitui a seleção registrada em cada decisão.

**Resultado geral:** ☐ Aprovado ☐ Rejeitado ☐ Necessita Revisão

**Diretor responsável:** (preencher)

**Data:** (dd/mm/aaaa)

**Assinatura:** (preencher)

**Observações:**

---

---

---
