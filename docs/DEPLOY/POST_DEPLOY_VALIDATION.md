# Validação Pós-Deploy — J12 Sports

> Checklist para uma janela de produção autorizada. Não autoriza deploy nem chamadas financeiras reais. Use contas e dados controlados, preserve privacidade e interrompa imediatamente diante de comportamento destrutivo ou integração não homologada.

## Registro

| Campo              | Valor                        |
| ------------------ | ---------------------------- |
| Release ID/SHA     |                              |
| Release anterior   |                              |
| Ambiente/hostnames |                              |
| Operador           |                              |
| Início/fim         |                              |
| Ticket/evidências  |                              |
| Resultado          | GO / ROLLBACK / CONTINGÊNCIA |

## Regras

- Executar somente após deploy e migrations autorizados terem terminado.
- Usar usuário sintético/controlado e identificadores marcados para limpeza.
- Não criar Pix, cobrar cartão, chamar Banco Inter ou disparar comunicação real.
- Não usar dados pessoais de clientes em screenshots/logs.
- Registrar status, latência, correlation/request ID e evidência sanitizada.
- Acionar rollback conforme `ROLLBACK_RUNBOOK.md` ao atingir critério de abort.

## 1. Health e readiness

- [ ] API `/live` retorna 200 independentemente do banco.
- [ ] API `/ready` e `/health` retornam 200 com dependências booleanas saudáveis.
- [ ] SSR `/live`, `/ready` e `/health` retornam 200.
- [ ] Endpoint externo `/health` reflete API readiness; `/ssr/health` reflete SSR readiness.
- [ ] Resposta degradada retorna 503 e não vaza detalhes internos.
- [ ] `/internal/health` permanece 404 sem token.
- [ ] Request/correlation IDs estão presentes e correlacionáveis nos logs.

## 2. TLS, proxy e assets

- [ ] HTTP redireciona para HTTPS em todos os hostnames públicos.
- [ ] Certificado/SAN/cadeia/validade estão corretos.
- [ ] Headers de segurança, cache e compressão correspondem à configuração aprovada.
- [ ] Rotas SSR carregam sem erro e assets com hash retornam cache imutável.
- [ ] `/api`, `/auth` e Socket.IO alcançam os upstreams corretos.
- [ ] Nenhuma porta interna está acessível publicamente.

## 3. Login e autorização

- [ ] Login válido funciona com conta controlada de cada papel crítico.
- [ ] Credencial inválida não revela existência de usuário nem detalhes internos.
- [ ] Sessão/token expira conforme política e logout invalida o acesso esperado.
- [ ] Papel sem permissão recebe 403; ausência de sessão recebe 401.
- [ ] Portais de aluno, responsável e professor permanecem no próprio escopo.
- [ ] Rate limit/força bruta não são testados agressivamente em produção; confirmar apenas por configuração e logs.

## 4. Financeiro

- [ ] Tela e endpoints administrativos read-only carregam valores esperados.
- [ ] Obrigações/cobranças de fixture controlada mantêm identidade canônica.
- [ ] Relatórios e paginação funcionam sem duplicidade aparente.
- [ ] Nenhuma ação de emitir/cancelar/sincronizar Pix é executada neste smoke.
- [ ] Banco Inter, webhook, n8n e automações externas permanecem no estado aprovado.
- [ ] Qualquer validação financeira mutável ocorre em plano separado, com reconciliação e owner.

## 5. Matrícula

- [ ] Consulta e listagem administrativa carregam sem erro.
- [ ] Fluxo controlado permitido mantém aluno/responsável/turma dentro do escopo.
- [ ] Repetição idempotente não duplica matrícula, vínculo ou obrigação.
- [ ] Estado de matrícula e relacionamentos refletem o schema esperado.
- [ ] Dados sintéticos criados possuem plano de limpeza auditável.

## 6. Campeonatos

- [ ] Listagem administrativa e portal público carregam.
- [ ] Detalhes, grupos, rodadas, jogos, classificação e estatísticas são coerentes.
- [ ] Área pública não expõe mutações ou dados pessoais.
- [ ] Nenhuma alteração competitiva real é feita fora de fixture/autorização específica.

## 7. Notificações

- [ ] Central in-app lista e marca notificações no escopo correto.
- [ ] Idempotência evita duplicidade na fixture controlada.
- [ ] Canais externos permanecem desabilitados durante smoke, salvo plano aprovado.
- [ ] Payload/log não expõe destinatários, tokens ou conteúdo sensível.

## 8. BI e relatórios

- [ ] Dashboards executivo, alunos, turmas, financeiro, inadimplência, quadras e campeonatos carregam.
- [ ] Período/filtros/unidade produzem resultados finitos, sem `NaN`/`Infinity`.
- [ ] Exportações controladas CSV/XLSX/PDF funcionam e neutralizam fórmulas.
- [ ] BI não expõe PII individual nem executa N+1 aparente.
- [ ] Totais críticos são comparados com uma referência aprovada.

## 9. Uploads

- [ ] Confirmar formalmente se produção suporta upload persistente.
- [ ] Se suportado, validar tipo, tamanho, autorização, malware policy e path fora da release.
- [ ] Arquivo controlado permanece disponível após reload/rollback conforme política.
- [ ] Path traversal, execução e acesso público indevido são bloqueados.
- [ ] Se não suportado/persistido, controles de UI/API permanecem desabilitados e o item é registrado como não aplicável.

## 10. Logs e observabilidade

- [ ] PM2 mostra exatamente API e frontend sem loop de restart.
- [ ] Logs estruturados incluem evento, nível, timestamp e IDs de contexto.
- [ ] Erros 5xx são sanitizados; token, cookie, senha, PII e secrets não aparecem.
- [ ] Queries e async instrumentados reportam duração sem parâmetros sensíveis.
- [ ] Rotação, retenção e espaço em disco estão normais.
- [ ] Alertas chegam ao canal/owner correto.

## 11. Monitoramento e janela de observação

- [ ] 5xx, p50/p95, CPU, memória, event loop, pool, disco e reinícios estão na baseline.
- [ ] Readiness/liveness permanecem estáveis.
- [ ] TLS, backup e jobs têm status verde.
- [ ] Nenhuma fila, webhook ou automação acumula falhas.
- [ ] Janela mínima acordada transcorreu sem critério de abort.

## 12. Browser E2E crítico

Executar somente a suíte previamente aprovada para produção/HML, sem alterar os testes e sem permitir integrações reais:

- [ ] Preflight confirma ambiente, fixtures e bloqueio de requests externos.
- [ ] Jornadas críticas de autenticação, autorização, matrícula e portais passam.
- [ ] Jornadas financeiras usam somente mocks/fixtures e não criam Pix real.
- [ ] Zero `unexpected`, `skipped` ou `flaky`, salvo exceção formalmente aceita.
- [ ] Artefatos, vídeos, traces e logs são sanitizados e anexados ao ticket.

Se a suíte não for explicitamente homologada para produção, executá-la em HML equivalente e registrar produção como **não executada**, nunca como PASS presumido.

## 13. Decisão

### GO

- todos os itens obrigatórios passaram;
- não há regressão ou alerta crítico;
- dados e integrações permanecem reconciliados;
- negócio, aplicação, DBA, segurança e infraestrutura aceitaram a evidência.

### Rollback/contingência

- health/readiness instável;
- erro crítico funcional, segurança ou integridade;
- crescimento sustentado de 5xx/latência/restarts;
- divergência de schema/dados;
- TLS/proxy/DNS inválido;
- observabilidade insuficiente para decidir com segurança.

Registrar a decisão, responsáveis, horário e link para o runbook acionado.
