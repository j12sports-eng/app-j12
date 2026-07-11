# Sprint 22.2 - Auditoria de segurança

Base: branch `sprint-22`, commit `fba00eb`, working tree inicial limpo. Auditoria local e não destrutiva; sem chamadas reais a Banco Inter, Pix, n8n, BotConversa, banco compartilhado ou VPS.

## Arquitetura real de autenticação

O cliente envia Bearer token guardado no navegador. O backend emite JWT HS256 com secret e expiração obrigatórios, valida assinatura/algoritmo/`exp` e recarrega o usuário do banco em cada request. Também existe compatibilidade com sessões opacas persistidas. Senhas novas usam `scrypt` com salt de 16 bytes e comparação timing-safe; hashes bcrypt legados continuam aceitos. Logout remove sessão opaca, mas JWT permanece válido até expirar; o cliente o remove localmente. Não há refresh token ou cookie de autenticação automático.

Consequência: CSRF clássico por cookie não é o vetor principal. XSS/token theft continua relevante porque o Bearer token reside no browser. Revogação imediata de JWT requer versão de sessão/denylist persistida e permanece risco residual.

## Achados e correções

| Prioridade | Achado | Tratamento |
| --- | --- | --- |
| P0 | PM2 produção/HML executava `server/index.mjs`, sem routers modernos | Corrigido para `backend/server.js`, composition root canônico |
| P1 | Reset revelava existência do usuário e token em `previewUrl` | Resposta uniforme; preview restrito a ambiente não produtivo |
| P1 | Diretório de professores expunha CPF/contrato/remuneração a qualquer autenticado | Leitura agora exige `canManageSystem` |
| P1 | Professor podia consultar/alterar presença fora de suas turmas | Ownership por `professor_id`, turma e matrícula ativa |
| P1 externo | Chave/certificado Inter rastreados | Não removidos; rotação/revogação e saneamento do histórico obrigatórios |
| P2 | Login/reset dependiam apenas do limite global | Limite específico: 10 tentativas/15 min por IP/path, configurável |
| P2 | Logout JWT sem revogação imediata | Documentado; requer persistência própria |

## HTTP e proteção de API

O composition root canônico usa CORS allowlist, `trust proxy=1`, limite de body, rate limit global e headers `nosniff`, `DENY`, referrer policy e permissions policy. CSP não foi adicionada nesta sprint para não quebrar TanStack SSR/assets sem teste no Nginx. HSTS depende do terminador HTTPS/Nginx e deve ser validado na VPS.

Erros 5xx são genéricos em produção; detalhes permanecem no servidor. SQL relevante usa parâmetros ou allowlists de ordenação. A Sprint não executou upload real; estruturas de logo recusam payload de upload e contratos PDF são geração local.

## Integrações

Banco Inter usa OAuth/mTLS, cache com expiração, timeout/retry e repositories idempotentes em testes. Webhooks possuem validação de assinatura/token e idempotência, mas autenticidade e replay precisam HML real após rotação dos certificados. Automação financeira usa Bearer de serviço, origin allowlist e rate limit dedicado. Nenhuma automação ou transação foi acionada.

## Dependências

`npm audit --omit=dev` encontrou 8 advisories: 3 altos, 3 moderados, 2 baixos, 0 críticos. Altos: Vite/Windows dev server, `form-data` transitivo e `ws` transitivo. Correções existem, mas atualização deve ocorrer em mudança isolada com lockfile, build e regressão; não foi feito upgrade indiscriminado nesta auditoria.

## Riscos residuais

- revogação imediata de JWT;
- certificados Inter rastreados e possivelmente presentes no histórico;
- validação operacional de TLS/Nginx, secrets e integrações depende de HML/VPS;
- ausência de E2E browser+DB multiusuário completo;
- dependências com advisories ainda pendentes de atualização controlada.
