# Decisões Executivas Recomendadas — Política de Identidade e CPF

## Situação do registro

As deliberações abaixo foram fornecidas pela Equipe J12. Os estados individuais são registrados exatamente como deliberados. O resultado geral ainda não está marcado e a data não foi preenchida; por isso, a tradução para a política declarativa e para o gate deverá ocorrer em etapa controlada posterior.

## Princípios aprovados

- Cada pessoa física terá uma única identidade global no ERP.
- Perfis, vínculos, matrículas, acessos e operações serão contextuais por unidade.
- A mesma Pessoa poderá ser simultaneamente aluno, responsável, professor, colaborador ou usuário.
- O CPF pertencerá à Pessoa, nunca ao perfil.
- E-mail e telefone poderão ser compartilhados.
- O CPF não será obrigatório para criar todo e qualquer cadastro.
- Quando informado e considerado válido, o CPF não poderá estar associado a outra Pessoa.
- Nenhuma duplicidade será resolvida por escolha automática, exclusão ou merge silencioso.
- A resolução global de identidade não concederá acesso global aos dados.

## DEC-01 — Natureza do domínio `people`

**Decisão:** Opção A — somente Pessoa Física.

**Estado:** `APPROVED`

O domínio `people` representará exclusivamente indivíduos. Empresas, fornecedores, patrocinadores e demais entidades jurídicas não serão cadastrados como Pessoa.

**Justificativa:** mantém o modelo coerente, permite tratar CPF como identificador pessoal e evita misturar regras de CPF e CNPJ.

## DEC-02 — Entidade para Pessoa Jurídica

**Decisão:** Opção A — criar entidade própria futuramente.

**Estado:** `APPROVED`

Pessoas jurídicas serão tratadas em entidade ou domínio próprio quando surgir necessidade funcional, incluindo fornecedores, patrocinadores, parceiros, empresas contratantes, clientes corporativos e locatários empresariais. Essa implementação não faz parte da trilha atual de Pessoas.

## DEC-03 — Papel oficial do CPF

**Decisão:** Opção A — identificador forte opcional.

**Estado:** `APPROVED`

A Pessoa poderá existir sem CPF nas etapas autorizadas. Quando informado e validado, o CPF identificará uma única Pessoa em todo o ERP. `people.id` continuará sendo a chave primária.

## DEC-04 — Momento de obrigatoriedade do CPF

**Estado:** `APPROVED WITH SPECIALIST REVIEW`

- **Lead:** não obrigatório.
- **Conversão do Lead:** obrigatório conforme a pessoa e a operação resultante; não inventar ou exigir CPF quando a política permitir ausência.
- **Pré-matrícula:** não obrigatório para iniciar; pendências documentais devem ficar claras.
- **Matrícula DRAFT:** pode existir sem CPF.
- **Matrícula ACTIVE:** CPF obrigatório para aluno adulto brasileiro e responsável contratual brasileiro; opcional para aluno menor; estrangeiro segue política alternativa.
- **Financeiro e contrato:** obrigatório para quem assumir responsabilidade contratual ou financeira, salvo exceção formal para estrangeiros.

Aplicação fiscal, contratual e documental depende de validação com contabilidade e jurídico antes da implementação.

## DEC-05 — Aluno menor sem CPF

**Decisão:** Opção A — permitir.

**Estado:** `APPROVED`

O aluno menor poderá possuir Pessoa, perfil e matrícula sem CPF próprio, desde que exista responsável válido e as regras contratuais sejam atendidas. O CPF do responsável nunca será gravado no campo do aluno.

## DEC-06 — Aluno adulto sem CPF

**Decisão:** Opção A — brasileiro não ativa matrícula sem CPF.

**Estado:** `APPROVED WITH EXCEPTION`

O aluno adulto brasileiro poderá possuir cadastro preliminar e matrícula `DRAFT`, mas não ativará matrícula sem CPF válido. Estrangeiros seguirão política documental própria e poderão não possuir CPF.

## DEC-07 — CPF do responsável

**Decisão:** Opção B — obrigatório antes da matrícula `ACTIVE`.

**Estado:** `APPROVED WITH SPECIALIST REVIEW`

Não será obrigatório para iniciar Lead ou pré-matrícula. Será obrigatório antes da ativação quando o responsável assumir responsabilidade contratual, financeira, assinatura ou pagamento. Exigências fiscais e contratuais dependem de jurídico e contabilidade.

## DEC-08 — Estrangeiros

**Decisão:** Opção A — permitir sem CPF.

**Estado:** `APPROVED`

É proibido gerar CPF fictício, usar sequência de zeros, CPF compartilhado ou armazenar passaporte/documento estrangeiro no campo CPF. O cadastro será sustentado por `people.id` até o suporte a documentos alternativos.

## DEC-09 — Documentos alternativos

**Decisão:** Opção A — planejar módulo ou estrutura própria.

**Estado:** `APPROVED FOR FUTURE IMPLEMENTATION`

O ERP suportará futuramente passaporte, CRNM/RNE, documento nacional estrangeiro, país emissor, tipo, número e validade quando aplicável. Esses documentos não serão armazenados nas colunas de CPF.

## DEC-10 — Nível de validação do CPF

**Decisão:** política em camadas.

**Estado:** `APPROVED`

1. **Normalizado:** somente 11 dígitos.
2. **Semanticamente válido:** dígitos verificadores válidos.
3. **Verificado:** confirmação administrativa ou integração futura.

Novos cadastros modernos exigirão no mínimo o segundo nível. Verificação externa não será obrigatória nesta fase.

## DEC-11 — Novo CPF inválido

**Decisão:** Opção A — rejeitar.

**Estado:** `APPROVED`

Fluxos modernos não persistirão CPF preenchido inválido. Erros não exporão CPF em logs ou mensagens técnicas. Cadastros sem CPF continuarão permitidos nos cenários autorizados.

## DEC-12 — CPF legado inválido

**Decisão:** Opção A — preservar e marcar para revisão.

**Estado:** `APPROVED`

Registros legados não serão apagados, corrigidos, preenchidos ou mesclados automaticamente. Entrarão em saneamento assistido e manterão `cpf_normalized = NULL` enquanto não saneados.

## DEC-13 — CPF duplicado

**Decisão:** bloquear e encaminhar para revisão.

**Estado:** `APPROVED`

Nenhuma nova Pessoa será criada ou escolhida automaticamente. Nenhum registro será excluído, sobrescrito ou mesclado automaticamente. O caso será conflito de identidade.

## DEC-14 — Alteração de CPF

**Decisão:** somente por processo autorizado e auditado.

**Estado:** `APPROVED WITH IMPLEMENTATION PENDING`

A alteração exigirá permissão específica, motivo, validação, verificação de conflito, data/hora, usuário, histórico anterior e auditoria. Telas comuns e integrações genéricas não poderão alterar CPF.

## DEC-15 — Histórico de CPF

**Decisão:** Opção A — manter histórico.

**Estado:** `APPROVED WITH LGPD REVIEW`

O histórico será restrito a finalidades legítimas de auditoria, correção, prevenção de fraude, resolução de conflito e conformidade. Retenção, anonimização e acesso dependem de validação LGPD/jurídica.

## DEC-16 — Pessoa inativa

**Decisão:** Opção A — continua reservando CPF.

**Estado:** `APPROVED`

Inativar matrícula, perfil, unidade, vínculo ou acesso não libera o CPF nem permite criar outra Pessoa com ele.

## DEC-17 — Exclusão física de Pessoa

**Decisão:** Opção C — apenas sem vínculos e por processo controlado.

**Estado:** `APPROVED WITH LGPD REVIEW`

Pessoas com histórico não serão excluídas fisicamente. Devem ser preferidas inativação, restrição de acesso, anonimização controlada e retenção mínima. Exclusão só será considerada sem vínculos, obrigações, financeiro, matrículas, contratos ou auditorias e mediante autorização.

## DEC-18 — Política para `cpf_normalized = NULL`

**Estado:** `APPROVED`

- **CPF ausente:** `cpf = NULL` e `cpf_normalized = NULL` são permitidos.
- **CPF válido:** original e normalizado são obrigatórios.
- **CPF legado inválido:** original preenchido e normalizado nulo são temporariamente permitidos para saneamento.
- **Novo CPF inválido:** rejeitado.

Nenhum novo writer moderno poderá criar CPF original preenchido com normalizado nulo.

## DEC-19 — Escopo da unicidade

**Decisão:** Opção A — unicidade global.

**Estado:** `APPROVED, CONDICIONADO AOS GATES TÉCNICOS`

Quando presente e válido, o CPF será único em todo o ERP, independentemente da unidade. A restrição física depende de validação MySQL isolada, diagnóstico operacional, zero duplicidades, zero drift relevante, saneamento, writers sincronizados e confirmação da política de Pessoa Física.

## DEC-20 — Identidade, acesso e privacidade

**Decisão:** resolução global e autorização contextual.

**Estado:** `APPROVED`

O sistema poderá reconhecer uma Pessoa globalmente sem conceder visualização global. Resolução não exporá PII; usuários sem permissão não verão CPF, e-mail ou telefone; vínculo com nova unidade exigirá autorização; logs não conterão CPF.

## Consolidação executiva

| Código | Decisão                               | Estado                                      |
| ------ | ------------------------------------- | ------------------------------------------- |
| DEC-01 | `people` somente Pessoa Física        | `APPROVED`                                  |
| DEC-02 | Pessoa Jurídica em entidade própria   | `APPROVED`                                  |
| DEC-03 | CPF forte e opcional                  | `APPROVED`                                  |
| DEC-04 | Obrigatoriedade por etapa             | `APPROVED WITH SPECIALIST REVIEW`           |
| DEC-05 | Menor pode existir sem CPF            | `APPROVED`                                  |
| DEC-06 | Adulto brasileiro não ativa sem CPF   | `APPROVED WITH EXCEPTION`                   |
| DEC-07 | CPF do responsável antes da ativação  | `APPROVED WITH SPECIALIST REVIEW`           |
| DEC-08 | Estrangeiro permitido sem CPF         | `APPROVED`                                  |
| DEC-09 | Documentos alternativos futuros       | `APPROVED FOR FUTURE IMPLEMENTATION`        |
| DEC-10 | Validação em camadas                  | `APPROVED`                                  |
| DEC-11 | Novo CPF inválido rejeitado           | `APPROVED`                                  |
| DEC-12 | Legado inválido preservado e revisado | `APPROVED`                                  |
| DEC-13 | CPF duplicado bloqueado               | `APPROVED`                                  |
| DEC-14 | Alteração autorizada e auditada       | `APPROVED WITH IMPLEMENTATION PENDING`      |
| DEC-15 | Histórico restrito                    | `APPROVED WITH LGPD REVIEW`                 |
| DEC-16 | Inativo continua reservando CPF       | `APPROVED`                                  |
| DEC-17 | Exclusão física excepcional           | `APPROVED WITH LGPD REVIEW`                 |
| DEC-18 | Política de normalizado nulo          | `APPROVED`                                  |
| DEC-19 | Unicidade global futura               | `APPROVED, CONDICIONADO AOS GATES TÉCNICOS` |
| DEC-20 | Identidade global e acesso contextual | `APPROVED`                                  |

## Registro de aprovação

**Responsável:** Equipe J12

**Data da aprovação:** 18/07/2026

**Resultado geral:** ☒ Aprovado ☐ Rejeitado ☐ Necessita revisão

**Observações:** Decisões adotadas como política oficial da J12 Sports. Condições de revisão especializada e implementação permanecem obrigatórias.

## Revisões especializadas pendentes

- obrigações contratuais e fiscais relacionadas ao CPF;
- retenção e histórico de documentos;
- exclusão, anonimização e direitos do titular;
- tratamento de documentos estrangeiros;
- política de acesso a dados entre unidades;
- prazo e fundamento para retenção de registros inativos.
