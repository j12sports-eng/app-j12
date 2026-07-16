# Sprint 24.5 — Security Hardening

## Melhorias implementadas

- Headers HTTP equivalentes ao Helmet: CSP restritiva para a API, proteção de MIME,
  framing, referrer, permissions, políticas cross-origin e HSTS em produção.
- Cache desabilitado para autenticação e requisições autenticadas.
- Rate limiting configurável por janela deslizante para tráfego geral,
  administrativo, público sensível e autenticação.
- Proteção contra força bruta com tentativas em janela deslizante, bloqueio
  temporário e chave pseudonimizada por IP e hash do identificador.
- Dez eventos de auditoria integrados ao logger JSON da Sprint 24.4.
- Validação defensiva de tipo e tamanho para payloads de autenticação.

## Eventos de segurança

LOGIN_SUCCESS, LOGIN_FAILURE, ACCESS_DENIED, TOKEN_INVALID, TOKEN_EXPIRED,
PERMISSION_DENIED, RATE_LIMIT_TRIGGERED, BRUTE_FORCE_TRIGGERED,
VALIDATION_FAILED e SECURITY_CONFIGURATION.

## Riscos mitigados

- Clickjacking, MIME sniffing, vazamento por referrer e permissões de navegador
  desnecessárias.
- Abuso volumétrico de endpoints sensíveis e tentativas automatizadas de senha.
- Persistência indevida de respostas autenticadas em caches.
- Payloads aninhados inesperados ou excessivamente grandes em autenticação.
- Ausência de trilha estruturada para decisões de segurança.

## Riscos remanescentes

- Os stores de rate limit e força bruta são locais ao processo e não são
  compartilhados entre múltiplas instâncias.
- Os eventos dependem do destino de console local; retenção e alertas externos
  permanecem fora do escopo.
- TOKEN_EXPIRED está definido no catálogo, mas sua classificação precisa de um
  erro de expiração distinguível no fluxo existente; a autenticação não foi
  modificada.
- CSP protege respostas da API. Uma política específica para páginas HTML deve
  ser definida no servidor frontend após inventário de assets.

## Compatibilidade e impacto esperado

Status, payloads, rotas, contratos e regras de negócio foram preservados.
Preflight e health checks continuam isentos. Testes podem desabilitar os limites
por ambiente, evitando interferência em regressões internas. O impacto esperado
é baixo e limitado à manutenção de pequenas estruturas em memória e emissão de
logs JSON.

## Validações executadas

Foram previstos node --check, regressões focadas, Backend, Frontend, Security,
Contracts, Migrations, Migration Runner, Topology, Integrity, Secret Scan, Build
Client, Build SSR, Prettier, ESLint escopado e git diff --check.
