# Sprint 23.6 — Ambiente HML isolado, descartável e seguro

Data: 2026-07-12. Branch inicial: `sprint-23`. HEAD inicial: `d7f173c9907f132696494961f9bc0870e5979131`.

## Conclusão executiva

A sprint preparou um perfil reproduzível e fail-closed para homologação local/isolada. Nenhum ambiente foi provisionado, nenhuma migration foi executada e nenhum banco ou serviço externo foi acessado. A classificação correta é **HML preparada em código, não operacionalmente provisionada ou validada**.

## Auditoria anterior

| Área         | Estado encontrado                              | Risco                                               |
| ------------ | ---------------------------------------------- | --------------------------------------------------- |
| Processo HML | `ecosystem.hml.config.cjs` existente           | reutilizava `.env`, permitindo compartilhar secrets |
| Banco        | sem composição descartável canônica            | destino e ciclo de vida não inequívocos             |
| URLs         | domínio HML e Nginx documentados               | sem validação central contra produção               |
| Integrações  | Inter, Resend, BotConversa e n8n configuráveis | sem bloqueio HML único e fail-closed                |
| Certificados | paths configuráveis e `certs/` ignorado        | sem perfil explícito sandbox                        |
| Migrations   | runner canônico da Sprint 23.3                 | precisava integrar o runbook HML                    |
| Reset        | inexistente                                    | comando artesanal poderia atingir recurso errado    |
| Dados        | seeds históricos                               | sem política canônica contra clone de produção      |
| Smoke        | checklist manual                               | sem restrição técnica ao loopback                   |

Foram encontrados defaults históricos de banco remoto em `backend/.env.example` e no adaptador de banco. Eles não foram alterados para evitar ampliação de escopo, mas o novo validador HML os rejeita.

## Arquitetura preparada

| Requisito            | Implementação                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| Banco isolado        | MySQL 8.4 em Compose, publicado apenas em `127.0.0.1`, rede interna e volume descartável rotulado |
| Secrets próprios     | template sem valores reais; `.env.hml` ignorado pelo Git                                          |
| Certificados sandbox | paths `certs/hml/inter-sandbox.*`, fora do Git                                                    |
| URLs próprias        | identidade, instance ID e URLs HML obrigatórias                                                   |
| Integrações reais    | flag false; e-mail, Inter, BotConversa e n8n desabilitados/vazios                                 |
| Dados sintéticos     | prefixo `[HML-SYNTHETIC]`, `example.test`, contatos não roteáveis e proibição de cópia real       |
| Migrations           | somente runner canônico; plano offline separado da execução confirmada                            |
| Reset seguro         | dry-run padrão; `--apply` e token exato com instance ID e banco                                   |
| Smoke                | `/health`, alvo limitado a HTTP em loopback                                                       |
| Identificação        | projeto `j12-hml-isolated`, labels, banco HML e instance ID                                       |
| Clientes reais       | outbound desabilitado; presença de credenciais é rejeitada                                        |

## Invariantes

1. `J12_ENVIRONMENT=hml`, `HML_ISOLATED=true` e integrações reais false.
2. Banco com sufixo HML e host loopback.
3. Hosts conhecidos de produção rejeitados.
4. E-mail e Inter desabilitados; credenciais outbound vazias.
5. Reset limitado ao projeto Compose HML e sujeito a confirmação exata.
6. Smoke automatizado limitado ao loopback.
7. Secrets/certificados nunca no repositório.
8. Dados reais nunca importados.

## Operação prevista

1. Criar secret file fora do Git a partir do template.
2. Executar `validate` sem rede ou banco.
3. Executar `plan-migrations` offline.
4. Em host isolado aprovado, subir o MySQL do Compose.
5. Executar o runner canônico com confirmação exata.
6. Iniciar API/SSR usando `.env.hml` e certificados sandbox.
7. Criar fixtures sintéticas pelas APIs de domínio.
8. Executar smoke local e registrar evidência.
9. Executar reset confirmado ao fim do ciclo.

## Dados sintéticos

Não foi criado SQL ad hoc, pois duplicaria contratos de schema. A carga deve usar APIs/serviços de domínio após migrations, com nomes `[HML-SYNTHETIC]`, e-mails `@example.test`, telefones não roteáveis, documentos inválidos/reservados e nenhum dado ou payload real.

## Gates executados

| Gate                                          | Resultado                             |
| --------------------------------------------- | ------------------------------------- |
| Guardrails HML focados                        | **5/5 aprovados**                     |
| Entry point canônico fail-closed              | **aprovado**, sem iniciar a API       |
| Plano canônico de migrations                  | **12/12 listadas em dry-run offline** |
| Backend completo                              | **589/589 aprovados**                 |
| Frontend completo                             | **78/78 aprovados**                   |
| ESLint focado                                 | **aprovado**                          |
| Prettier focado                               | **aprovado**                          |
| `git diff --check`                            | **aprovado**                          |
| Build oficial Client/SSR                      | **aprovado**, 3.737 módulos no Client |
| Provisionamento/restore/migrations/smoke real | **não executados / não comprovados**  |

Observação: tentativas iniciais com Vitest foram descartadas porque a configuração global coletou testes `node:test` como suites incompatíveis. Os gates válidos usaram `node --test` com escopo explícito; não houve falha funcional.

## Matriz de comprovação

| Item                       | Classificação                                                              |
| -------------------------- | -------------------------------------------------------------------------- |
| Template/identidade        | implementado e validado localmente                                         |
| Banco Compose isolado      | implementado, não provisionado                                             |
| Guardrails                 | implementados e testados localmente                                        |
| Migrations                 | integradas ao runbook; não executadas                                      |
| Reset                      | implementado e testado sem aplicação                                       |
| Smoke                      | implementado; alvo real não executado                                      |
| Certificados sandbox       | contrato preparado; não fornecidos/validados                               |
| Dados sintéticos           | política preparada; dataset não carregado                                  |
| Proteção de clientes reais | preflight ocorre antes de carregar a API; não homologada em infraestrutura |
| HML operacional            | **não comprovada**                                                         |

## Limitações

- Docker não está instalado neste workstation; o Compose não foi validado com daemon.
- Não há host/namespace HML provisionado nesta evidência.
- Secrets, certificados sandbox e DNS/TLS não foram fornecidos.
- Migrations, carga, startup e smoke real não foram executados.
- Clientes outbound legados dependem do preflight do composition root HML e não devem ser executados por entrypoint alternativo.

## Arquivos

- `config/hml/hml.env.example`: contrato sem secrets.
- `deploy/hml/docker-compose.hml.yml`: banco descartável em loopback.
- `scripts/hml/hml-core.cjs`: validações fail-closed.
- `scripts/hml/j12-hml.cjs`: validação, plano, reset e smoke.
- `backend/server.js`: preflight HML antes do carregamento da aplicação.
- `scripts/hml/hml-core.test.cjs`: testes locais.
- `scripts/hml/README.md`: runbook.
- `ecosystem.hml.config.cjs`: secrets separados e identidade HML.
- este relatório.

## Percentual real

- preparação em código/documentação: **100%**;
- testes locais: **100%**;
- infraestrutura provisionada: **0%**;
- migrations/dados em HML real: **0%**;
- smoke operacional E2E: **0%**;
- HML operacional: **não comprovada**.

Nenhuma ação da Sprint 23.7 foi iniciada. Não houve acesso a produção, banco compartilhado, Banco Inter, n8n, e-mail, webhook ou cliente real.
