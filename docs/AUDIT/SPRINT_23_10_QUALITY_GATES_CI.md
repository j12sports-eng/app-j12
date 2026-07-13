# Sprint 23.10 — Quality Gates e CI Seguro

## Objetivo e estado anterior

A Sprint 23.10 implementa integração contínua com gates offline, sem deploy automático. A auditoria de recuperação confirmou que o HEAD `23a97406f920bb95182c0fc269e9882fa1b588e7` e `origin/sprint-23` não continham workflows em `.github/workflows/`; a implementação estava somente no working tree e foi preservada.

Branch auditada: `sprint-23`. No início e no encerramento desta validação, o HEAD local permanecia um commit à frente de `origin/sprint-23` (`0 behind / 1 ahead`). Não havia arquivos staged nem arquivos de outra sprint misturados no working tree inicial.

## Arquitetura do pipeline

O workflow `.github/workflows/quality-gates.yml` executa em pull requests, pushes para `main` e `sprint-23`, e acionamento manual. Ele usa permissões mínimas (`contents: read`), checkout com histórico completo, Node.js 22 compatível com `engines.node >=22`, cache npm e instalação determinística com `npm ci --ignore-scripts` na raiz e no backend.

A base de comparação usa, em ordem: SHA base do pull request, `github.event.before` para push normal, pai do HEAD no fallback e a árvore vazia para o primeiro commit. O pipeline contém somente um job de qualidade e não possui deploy, SSH, PM2, migrations reais ou dependência de ambiente produtivo.

Ordem dos gates:

1. scanner de secrets e arquivos proibidos;
2. contratos de CI/deploy offline;
3. contratos de migrations;
4. testes de segurança;
5. testes backend;
6. testes frontend;
7. baseline progressivo ESLint;
8. ESLint, Prettier e whitespace do diff;
9. build Client/SSR e validação de artefatos;
10. upload de artefatos e relatórios do próprio job.

## Baseline progressivo ESLint

O baseline canônico está em `.ci/eslint-baseline.json`. A medição deliberadamente regenerada em 2026-07-13 registrou:

- 668 erros e 0 warnings;
- 592 fingerprints distintas;
- multiplicidade total de 668;
- `prettier/prettier`: 660;
- `@typescript-eslint/no-require-imports`: 5;
- `react-hooks/rules-of-hooks`: 3.

Cada fingerprint SHA-256 combina caminho relativo normalizado, regra, mensagem e linha-fonte. A comparação considera identidade e multiplicidade; portanto, remover um erro antigo não compensa um erro novo diferente. O JSON é ordenado, independente de caminhos absolutos e validado quanto a versão, estrutura, contagens, fingerprints e multiplicidade. Baseline ausente ou corrompido falha fechado fora do modo explícito `--write`.

O contrato automatizado comprovou: estado atual passa; redução passa; erro novo falha; troca de erro antigo por novo falha; aumento de multiplicidade falha; redução de multiplicidade passa; JSON corrompido falha; baseline ausente falha, exceto com `--write`.

## Secret scanning

O scanner inventaria arquivos tracked e untracked não ignorados com `git -c core.quotepath=false ls-files -z`, decodificação UTF-8 e separação NUL. Assim, nomes Unicode e com espaços permanecem íntegros e o `.gitignore` é respeitado.

São bloqueados `.env` versionados, certificados, chaves privadas, dumps, backups SQL, tokens de alta confiança, URLs com credenciais e atribuições sensíveis não fictícias. Migrations SQL oficiais não são bloqueadas pelo simples sufixo `.sql`. Findings registram somente arquivo e tipo, nunca o valor detectado.

Fixtures são aceitas de forma estreita: chave privada com corpo exato `fixture-only` somente em arquivo de teste, URL canônica `user:pass@host` e atribuição iniciada por `fixture-only` somente em teste. O contrato isolado comprovou inventário Unicode/espaços, migration permitida, arquivo ignorado desconsiderado, fixture permitida, chave real bloqueada sem vazamento e backup SQL bloqueado.

## Quality gate de arquivos alterados

O gate exige SHA explícito, valida que a base existe e é commit ou árvore, usa diff `ACMR` com saída NUL e `core.quotepath=false`, e aplica ESLint/Prettier somente às extensões suportadas. O whitespace check permanece aplicado ao diff completo. Base ausente ou inválida falha fechado.

Na validação local contra `origin/sprint-23`, ESLint e Prettier passaram, mas o whitespace check encontrou linhas em branco extras no EOF de seis arquivos já comprometidos pela Sprint 23.9:

- `deploy/almalinux/deploy-release.sh`;
- `deploy/almalinux/j12-deploy.conf.example`;
- `deploy/almalinux/lib.sh`;
- `deploy/almalinux/preflight.sh`;
- `deploy/almalinux/rollback.sh`;
- `deploy/almalinux/smoke.sh`.

Esses arquivos não foram alterados pela Sprint 23.10 para preservar o escopo exclusivo. O `git diff --check` do working tree da Sprint 23.10 passou.

## Suítes e resultados exatos

| Gate                                               | Resultado                                                                        |
| -------------------------------------------------- | -------------------------------------------------------------------------------- |
| Contratos CI/deploy e regressões                   | 12/12 aprovados                                                                  |
| Migrations                                         | 19/19 aprovados                                                                  |
| Segurança                                          | 34/34 aprovados                                                                  |
| Backend completo                                   | 598/598 aprovados                                                                |
| Frontend completo                                  | 78/78 aprovados                                                                  |
| Secret scan                                        | 1.612 arquivos, 0 findings                                                       |
| Baseline ESLint                                    | 668/668 históricos, 0 regressões                                                 |
| ESLint focado em `scripts/ci/*.cjs`                | aprovado                                                                         |
| Prettier dos arquivos da Sprint 23.10              | aprovado                                                                         |
| Sintaxe de todos os scripts `scripts/ci/*.cjs`     | aprovada                                                                         |
| Workflow YAML                                      | válido                                                                           |
| `git diff --check` do working tree                 | aprovado                                                                         |
| Quality gate contra `origin/sprint-23`             | ESLint/Prettier aprovados; whitespace bloqueado por seis arquivos da Sprint 23.9 |
| Build oficial Client/SSR                           | aprovado                                                                         |
| Artefatos `dist/client` e `dist/server/server.mjs` | presentes                                                                        |

Os testes de migrations usam contratos/mocks e não aplicaram migrations reais. As suítes carregaram a configuração local existente e instanciaram pools lazy, mas não executaram acesso intencional a banco externo. Os testes financeiros provaram bloqueios e mocks; não criaram Pix, não chamaram Banco Inter, webhooks ou n8n externos.

## Arquivos da Sprint 23.10

Criados:

- `.ci/eslint-baseline.json`;
- `.github/workflows/quality-gates.yml`;
- `scripts/ci/changed-quality.cjs`;
- `scripts/ci/ci-contract.test.cjs`;
- `scripts/ci/eslint-baseline.cjs`;
- `scripts/ci/eslint-baseline.test.cjs`;
- `scripts/ci/secret-scan.cjs`;
- `scripts/ci/secret-scan.test.cjs`;
- `scripts/ci/test-suites.cjs`;
- `docs/AUDIT/SPRINT_23_10_QUALITY_GATES_CI.md`.

Alterados:

- `.gitignore`, para ignorar relatórios gerados em `artifacts/`;
- `package.json`, para expor os scripts `ci:*`.

## Limitações e riscos residuais

A dívida ESLint histórica continua visível em vez de ser mascarada. O pipeline bloqueia novas fingerprints e aumentos de multiplicidade, mas a redução dos 668 erros deve ocorrer gradualmente em sprints próprias.

O quality gate do diff remoto continuará bloqueando uma comparação que inclua o commit da Sprint 23.9 até que as seis linhas em branco extras sejam corrigidas em escopo autorizado. Essa correção não foi incorporada silenciosamente à Sprint 23.10.

## Confirmações operacionais

Não houve commit, push, tag, deploy, SSH, acesso a VPS, produção, HML externa ou banco externo; nenhuma migration/restore real foi executada; nenhuma integração externa ou secret real foi alterado. A Sprint 23.11 não foi iniciada.

Classificação: implementação da Sprint 23.10 completa e gates próprios aprovados, com conclusão formal condicionada à dívida de whitespace preexistente da Sprint 23.9 no diff remoto.
