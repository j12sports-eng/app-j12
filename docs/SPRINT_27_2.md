# Sprint 27.2 — Estabilização do Preview Financeiro do Centro de Comando

## Objetivo e estado inicial

Estabilizar a integração vertical criada na Sprint 27.1 sem adicionar funcionalidades financeiras. A branch `sprint-23` iniciou limpa, com `npm run typecheck` e builds client/SSR aprovados.

## Arquitetura auditada

Fluxo real:

```text
FinancialCommandCenterPreview
→ useFinancialBI / useBIContract
→ financialPreviewProvider
→ normalizeFinancialPreviewSource
→ createFinancialProvider
→ adaptFinancialContract
→ GET /api/admin/bi/financial?period=CURRENT_MONTH
→ requireAuth + canManageSystem
→ BiFinancialController
→ BiFinancialService
→ MySqlBiFinancialRepository (leitura)
→ DTO financeiro 21.3
→ contrato normalizado do Centro de Comando
→ apresentação
```

A API retorna um envelope `{ success, data }`, extraído pelo cliente compartilhado. O contrato bruto 21.3 contém `generatedAt` ISO, filtros atual/anterior, seis KPIs monetários, `evolution`, quatro breakdowns e insights. O contrato normalizado adiciona `goalAchievement` e marca `netResult` como indisponível, sem calculá-lo.

## Arquivos auditados

- rota e componente do preview;
- hook financeiro e boundary compartilhado React Query;
- provider e adapter financeiros e compartilhados;
- contratos financeiro e compartilhado do Centro de Comando;
- API, hook, tipos e dashboard do BI financeiro;
- rota, autenticação, controller, service, DTO, repository e testes do BI no backend;
- documentação 27.1A e scripts de validação.

## Problemas encontrados

- loading inicial mostrava “Pendente” e contagens zero como resultado;
- ausência de estado vazio;
- refresh indistinguível do loading inicial;
- erro técnico (`error.message`) exposto diretamente;
- datas exibidas sem validação;
- acesso profundo ao payload antes de proteção de runtime;
- dependência exclusiva da tipagem estática para garantir arrays e números;
- ausência de teste específico da integração da Sprint 27.1.

## Correções e contrato final

`normalizeFinancialPreviewSource` é a fronteira defensiva entre a resposta da API e o Adapter. Ela:

- aceita a resposta como dado não confiável em runtime;
- mantém somente números finitos;
- converte valores monetários ausentes ou inválidos em KPI indisponível com `value: null`;
- garante arrays para `evolution` e todos os breakdowns;
- preserva valores financeiros válidos sem soma, conversão de centavos ou recálculo;
- mantém o timezone canônico `America/Sao_Paulo`;
- não inventa datas: entradas ausentes permanecem vazias e a apresentação usa fallback;
- produz o envelope read-only canônico pelo Adapter existente.

O contrato final mantém KPIs tipados, `evolution` como lista de `{ period, receivedRevenue }`, breakdowns como records de listas `{ key, quantity, value }`, filtros resolvidos, metadados, fonte e `readOnly: true`.

## Estados da interface

- **Loading inicial:** painel de carregamento, sem “Pendente” e sem zeros financeiros.
- **Refresh:** dados anteriores permanecem renderizados; `isFetching` mostra “Atualizando” e bloqueia cliques duplicados.
- **Empty:** todos os KPIs indisponíveis, `evolution` vazia e todos os breakdowns vazios.
- **Error sem dados:** mensagem segura e botão acessível de recarga, sem stack ou detalhes internos.
- **Error de refresh:** dados anteriores preservados com aviso não técnico.
- **Success:** somente contagens derivadas de arrays normalizados; nenhum `undefined`, `null`, `NaN` ou data inválida é apresentado.

## Datas e valores

`generatedAt` e `lastUpdate` são validados antes da formatação com `Intl.DateTimeFormat`, locale `pt-BR` e timezone `America/Sao_Paulo`; valores ausentes ou inválidos exibem `—`. Valores monetários não são recalculados na interface. O DTO do backend continua responsável por precisão de duas casas, e a normalização rejeita `NaN`/`Infinity` sem converter strings monetárias.

## Segurança e garantias read-only

- único método HTTP: `GET /api/admin/bi/financial`;
- rota protegida por autenticação e `canManageSystem` no backend e por roles no frontend;
- `unitId` vem do filtro resolvido pelo backend, não de entrada arbitrária do componente;
- repository implementa somente consulta analítica;
- nenhum POST, PUT, PATCH, DELETE, baixa, cobrança, conciliação, parcelamento ou pagamento;
- nenhuma alteração de schema, migration, endpoint, autenticação ou autorização;
- nenhum log novo e nenhum payload sensível registrado.

## Testes

Arquivo específico: `src/features/command-center/tests/financial-preview.test.mjs`.

Cobertura:

- resposta real completa e contrato 21.3;
- resposta parcial;
- KPIs ausentes e inválidos;
- evolution e breakdowns vazios ou fora do tipo;
- rejeição de `NaN` e `Infinity`;
- definição de empty e success;
- datas válidas, ausentes e inválidas;
- endpoint GET-only e ausência de mutations;
- estados loading, empty, error, refresh-error e success;
- acionamento de refetch e erro seguro.

Comandos executados durante a implementação:

- bateria financeira frontend/backend e preview: 15 aprovados, 0 falhas;
- `npm run lint:command-center`: aprovado;
- `npm run typecheck`: aprovado, zero erros;
- `npm run build`: client aprovado com 3860 módulos e SSR aprovado com 572 módulos.

## Itens não alterados e riscos residuais

Não foram alterados schema, migrations, endpoints, regras financeiras, autenticação, autorização, módulos sem dependência direta, `tsconfig` ou contratos públicos do BI. O hook compartilhado recebeu apenas o campo aditivo `fetching`.

Risco residual: o teste puro importa TypeScript diretamente no Node 22, que emite aviso de módulo sem `type: module`; o aviso não afeta execução e o `package.json` não foi alterado para evitar impacto global. A fonte continua marcada `partial` porque resultado líquido não existe no BI atual.

## Próximo passo recomendado

Promover o preview estabilizado para um widget oficial somente após definição de produto e revisão de permissões, sem reutilizar a rota técnica como funcionalidade financeira operacional.
