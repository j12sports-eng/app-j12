# Sprint 27.18B.1 — Validação E2E do Kanban em Desktop e Touch

## Escopo e estado de partida

- Branch auditada: `sprint-23`.
- Commit base: `a8c80dc4f37ff5121a70b364c5d6e0dc6b96c4bc` (`feat(crm): adiciona drag-and-drop seguro no kanban`).
- Worktree inicial: limpo.
- Escopo: validação E2E do Kanban existente e somente correções mínimas comprovadas.
- Fora do escopo: migrations, schema, novos estágios, nova API, conversão automática, WebSocket, SLA e retomada das Sprints MySQL suspensas.

## Auditoria

A infraestrutura existente já continha Playwright, configuração, runner e fixtures de outra sprint. O runner antigo sobe MySQL local e aplica migrations; por isso ele não foi reutilizado nesta validação. Foi criada uma configuração Playwright dedicada que inicia somente o Vite em `127.0.0.1:3018` e intercepta integralmente o contrato `/api/internal/crm`.

Foram auditados:

- autenticação e armazenamento locais, `ProtectedRoute`, cliente HTTP e aliases `/api`;
- `CrmLeadsPage`, cards, colunas, overlay, diálogo, hooks de drag/mutation, query keys, responsividade e observabilidade;
- contrato do `PATCH /internal/crm/leads/:leadId/stage`, allowlist, LOST, WON, conflito e autorização;
- testes frontend/backend do CRM, política de teardown, screenshots e exclusão de artefatos.

## Ferramenta e ambiente

- Playwright já instalado no projeto, executado pelo comando `npm run e2e:27.18b.1`.
- Navegador: Chromium, projetos `chromium-desktop` e `chromium-touch`.
- Servidor: Vite local isolado; backend não é iniciado no E2E.
- Viewports: desktop `1440x1000`, preset Pixel 7 com touch e tablet `768x900`.
- Execução serial, sem retries, com teardown automático do Vite.
- Screenshots finais por teste, trace em falha e relatório JSON em `artifacts/e2e/crm-kanban/`.
- `artifacts/` já está excluído pelo `.gitignore`; nenhuma imagem binária foi versionada.

## Dados e mocks HTTP

Somente dados sintéticos foram usados:

- Lead A: `NEW / OPEN`, transições para CONTACTED ou LOST;
- Lead B: `NEGOTIATION / OPEN`, transições para WON ou LOST;
- Lead C: `WON / CONVERTED`, terminal;
- Lead D: `LOST / LOST`, terminal.

O mock `page.route` reproduz envelopes de lista, detalhe, pipeline e PATCH. Ele mantém estado em memória, atraso controlado, contagem de requests e respostas de sucesso, erro 500, `CRM_STAGE_CONFLICT` e 403. O endpoint de conversão é uma sentinela que falha se chamado. Requests externos são bloqueados e o socket é encerrado no browser.

O body do PATCH é verificado por igualdade estrita. Campos permitidos: `nextStage`, `expectedStage`, `expectedStatus` e `reason` somente em LOST. Campos de escopo, PII e metadata são rejeitados pelas asserções.

## Cenários automatizados

### Desktop e mouse

- carregamento autenticado do Kanban e abertura abaixo do limite simples de 30 s;
- overlay, destaque de CONTACTED, um único PATCH e permanência na origem durante `pending`;
- atualização somente após resposta/invalidação e toast de sucesso, sem reload;
- destino QUALIFIED inválido, cursor proibido, cancelamento, zero PATCH e `DRAG_CANCELLED`;
- LOST com modal, confirmação desabilitada sem motivo, reason no PATCH e estado terminal;
- WON com cancelamento e confirmação explícita, retorno `CONVERTED` e nenhum endpoint de conversão;
- erro 500 com rollback visual e toast sanitizado;
- conflito 409 com nova listagem, reposicionamento em QUALIFIED e sem retry automático;
- handle desabilitado durante `pending`, sem PATCH/histórico duplicado;
- 403 sanitizado.

### Touch e responsividade

- Pixel 7 com `pointerType: touch`, ativação do sensor, overlay, navegação horizontal e drop em CONTACTED;
- `touch-action: none` e `user-select: none` no handle, sem capturar o scroll fora do gesto;
- cards e alternativa manual permanecem utilizáveis no mobile;
- tablet `768x900` com diálogo integralmente dentro do viewport;
- desktop largo `1440x1000` com colunas horizontalmente acessíveis.

### Teclado e acessibilidade operacional

- foco explícito no handle, início por Space e cancelamento por Escape;
- alternativa manual “Alterar estágio” confirmada com sucesso;
- handle com nome acessível por Lead, `aria-busy`, foco visível, diálogo com role apropriado e destinos identificados por heading;
- admin e coordenador acessam; professor é redirecionado e não vê a ação.

### Observabilidade e segurança

Foram validados `DRAG_STARTED`, `DRAG_DROPPED`, `DRAG_CANCELLED`, `DRAG_SUCCEEDED` e `DRAG_FAILED`. A telemetria tem duração não negativa, correlação, Lead ID e estágios. Não contém reason, body, token, unidade, usuário, contato, e-mail, telefone ou metadata.

## Defeitos comprovados e correções mínimas

1. O overlay ficava deslocado horizontalmente porque era renderizado sob um ancestral transformado do layout. Correção: portal do `DragOverlay` para `document.body`.
2. `CRM_STAGE_CONFLICT` exibia toast, mas não atualizava a lista: o `onError` estava ligado por engano à mutação de conversão. Correção: handler movido para `useMoveCrmLeadStage`, invalidando lista, detalhe, pipeline e histórico.
3. O handle tinha `touch-action: auto`, permitindo que o browser capturasse o gesto. Correção: classes `touch-none` e `select-none` somente no handle.
4. A modal controlada não possuía `DialogTrigger` e deixava o foco inativo ao fechar. Correção: `onCloseAutoFocus` retorna o foco ao botão de estágio do mesmo Lead, inclusive após reposicionamento.

Nenhuma alteração backend, migration, tabela, etapa ou funcionalidade adicional foi necessária.

## Resultados

- E2E Playwright: **8/8** aprovados em aproximadamente 1,9 minuto.
- Frontend CRM: **24/24** aprovados.
- Backend CRM selecionado: **21/21** aprovados.
- Contratos de rota repetidos com host restrito a `127.0.0.1:1`: **7/7** aprovados.
- TypeScript, build cliente/SSR, Prettier e secret scan: aprovados; **0** segredos em 2.255 arquivos.
- ESLint direcionado a todos os arquivos de código alterados: aprovado. O comando global `eslint . --quiet` foi executado, mas permaneceu consumindo CPU sem produzir resultado por vários minutos e foi encerrado somente no processo iniciado por esta sprint.

Evidências locais:

- `artifacts/e2e/crm-kanban/results.json`;
- `artifacts/e2e/crm-kanban/test-results/*/test-finished-1.png` — oito screenshots finais;
- em caso de falha futura, `trace.zip` no diretório do teste.

## MySQL e segurança do ambiente

O E2E não inicia backend, não aplica migration e não acessa banco. Os testes backend usam fakes/injeção. Uma execução inicial dos contratos carregou a configuração do `.env` e instanciou o pool lazy do `mysql2`, sem chamar `getConnection`, `query` ou abrir conexão. O gate foi repetido com `DB_HOST=127.0.0.1`, `DB_PORT=1`, timeout de 50 ms e keepalive desabilitado, eliminando a possibilidade de acesso remoto.

As Sprints `27.17A.4.1C.1`, `27.17A.4.1E` e `27.17A.4.2` permanecem suspensas e não foram retomadas.

## Limitações e riscos

- Touch foi emulado no Chromium/Pixel 7; ainda é recomendável smoke em aparelho físico na homologação.
- Firefox, WebKit e leitores de tela reais não fazem parte da matriz atual.
- Zoom de 200% não foi automatizado; a validação cobre layout mobile/tablet e navegação operacional por teclado.
- O lint global do repositório não concluiu no ambiente; o risco desta alteração foi reduzido com ESLint direcionado, TypeScript, build e regressões CRM.
- Os mocks são fiéis ao contrato auditado, mas não substituem uma homologação integrada contra backend local isolado quando houver banco descartável aprovado.
- As contagens são dos Leads carregados, preservando o comportamento existente.

## Recomendação

A Sprint 27.18B.1 está apta para homologação funcional desktop/touch, com smoke adicional em dispositivo físico recomendado. O próximo passo é apenas avaliar a Sprint 27.18C — SLA e Tempo por Etapa do Funil — sem iniciá-la automaticamente.
