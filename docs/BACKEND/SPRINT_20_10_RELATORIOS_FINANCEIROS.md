# Sprint 20.10 - Fase A - Relatórios Financeiros Avançados

## Objetivo e escopo

Implementar no backend o subdomínio `financeiro/reports`, com consultas agregadas, filtros, paginação e exportações. Nenhum frontend, migration, Prisma, regra de cobrança ou operação do Banco Inter foi alterado.

## Arquitetura

```text
HTTP administrativo
       |
FinancialReportController
       |
FinancialReportService
       |-- DTOs / Validators
       |-- CSV / PDF / XLSX exporters
       |
FinancialReportRepository
       |
MySqlFinancialReportRepository
       |
MySQL somente leitura
```

O controller não contém SQL. O service concentra cálculos e formatos de resposta. O repository usa agregações parametrizadas e um número fixo de consultas, sem N+1.

Não foi criada Entity porque relatórios são projeções imutáveis, não objetos com ciclo de vida ou persistência própria.

## Fontes de dados

- `j12_financeiro_cobrancas`: receitas, despesas explicitamente categorizadas, mensalidades e dimensões.
- `j12_turmas`: professor associado à turma.
- `financial_payments`: PIX e conciliação Banco Inter em modo somente leitura.
- `financial_automation_events`: eventos e falhas das automações.
- `j12_mensalidades`: correlação entre evento de mensalidade e cobrança.

## Endpoints

Todos exigem autenticação e `canManageSystem`. São montados com e sem prefixo `/api`.

| Método | Endpoint                                         | Resultado                                    |
| ------ | ------------------------------------------------ | -------------------------------------------- |
| GET    | `/api/admin/financeiro/relatorios`               | relatório consolidado                        |
| GET    | `/api/admin/financeiro/relatorios/financeiro`    | receitas, despesas, saldo, caixa e dimensões |
| GET    | `/api/admin/financeiro/relatorios/mensalidades`  | status e itens paginados                     |
| GET    | `/api/admin/financeiro/relatorios/inadimplencia` | devedores, valores, evolução e percentual    |
| GET    | `/api/admin/financeiro/relatorios/pix`           | PIX por status, conciliações e itens         |
| GET    | `/api/admin/financeiro/relatorios/automacoes`    | eventos e falhas de automação                |
| GET    | `/api/admin/financeiro/relatorios/export/pdf`    | PDF                                          |
| GET    | `/api/admin/financeiro/relatorios/export/xlsx`   | planilha OOXML/XLSX                          |
| GET    | `/api/admin/financeiro/relatorios/export/csv`    | CSV UTF-8 com BOM                            |

Os mesmos caminhos sem `/api` também existem por compatibilidade com o padrão do servidor.

## Filtros

| Filtro          | Aliases                      | Regra                               |
| --------------- | ---------------------------- | ----------------------------------- |
| período inicial | `from`, `dateFrom`, `inicio` | data ISO; padrão de 30 dias         |
| período final   | `to`, `dateTo`, `fim`        | data ISO; padrão hoje               |
| unidade         | `unit`, `unidade`            | correspondência exata parametrizada |
| modalidade      | `modality`, `modalidade`     | correspondência exata parametrizada |
| professor       | `professor`                  | nome ou ID relacionado à turma      |
| turma           | `turma`                      | correspondência exata               |
| categoria       | `category`, `categoria`      | campo `tipo` da cobrança            |
| status          | `status`                     | comparação normalizada              |
| paginação       | `page`, `limit`              | limite padrão 100 e máximo 500      |

Exemplo de consulta:

```text
GET /api/admin/financeiro/relatorios/financeiro?from=2026-07-01&to=2026-07-31&unidade=Centro&modalidade=Futebol
```

## Payload de resposta

```json
{
  "success": true,
  "data": {
    "report": "financeiro",
    "generatedAt": "2026-07-09T12:00:00.000Z",
    "receitas": 1000,
    "despesas": 200,
    "saldo": 800,
    "fluxoCaixa": [],
    "categorias": [],
    "professores": [],
    "turmas": [],
    "modalidades": []
  }
}
```

## Relatórios

### Financeiro Geral

- receitas e despesas pagas no período;
- saldo calculado no service;
- fluxo de caixa mensal;
- categorias;
- receitas por professor, turma e modalidade.

### Mensalidades

- pagas, pendentes, vencidas, canceladas e renegociadas;
- total por status e valor;
- itens paginados.

### Inadimplência

- alunos inadimplentes distintos;
- quantidade e valor vencido;
- evolução mensal;
- percentual sobre a carteira não cancelada do mesmo filtro;
- ranking paginado de alunos.

### Banco Inter / PIX

- emitidos, pagos, cancelados e expirados;
- valor por status;
- conciliações identificadas por `e2eid` ou transação Inter;
- consulta estritamente de leitura.

### Automações

- lembretes e cobranças enviadas;
- pagamentos confirmados;
- agradecimentos;
- falhas;
- evolução diária por status.

## Exportações

- PDF: gerado com `jspdf`, biblioteca já presente no projeto.
- XLSX: pacote OOXML mínimo válido, sem dependência adicional.
- CSV: UTF-8 com BOM e células escapadas.

O parâmetro `report` aceita `all`, `financeiro`, `mensalidades`, `inadimplencia`, `pix` ou `automacoes`.

```text
GET /api/admin/financeiro/relatorios/export/xlsx?report=mensalidades&from=2026-07-01&to=2026-07-31
```

## Performance

- agregações `SUM`, `COUNT`, `COUNT DISTINCT` e `GROUP BY` executadas no MySQL;
- filtros sempre parametrizados;
- paginação SQL para listas de mensalidades, inadimplentes e PIX;
- número fixo de consultas por relatório;
- uso dos índices existentes de status, vencimento, competência, aluno e data de pagamento;
- nenhuma migration ou índice novo nesta fase.

## Decisões e limitações

- O schema atual não possui livro-razão dedicado de despesas. Apenas registros com `tipo` explicitamente igual a despesa são contabilizados como tal; não se inferem custos de professor ou Banco Inter.
- O ENUM atual de mensalidades/cobranças não inclui `renegociado`. O campo é retornado no contrato, mas permanece zero até existir fonte autorizada.
- Associação de professor é feita pela turma registrada na cobrança; registros sem turma aparecem como não informados.
- O relatório de pagamentos confirmados depende de eventos `PAGAMENTO_CONFIRMADO`; eventos ausentes não são inferidos.
- Não foram criados índices por causa da proibição de migrations. O plano de execução deve ser aferido em HML antes de grandes volumes.
- PDF limita a renderização a 300 linhas para controlar memória; CSV e XLSX são adequados a conjuntos maiores dentro do limite de paginação/exportação atual.

## Testes

Mocks cobrem cálculos, filtros, agregações, paginação, ausência de N+1, respostas HTTP, rotas e os três formatos de exportação. Nenhum teste acessa banco ou Banco Inter real.

## Próximos passos

1. Executar `EXPLAIN` das consultas em uma cópia HML representativa.
2. Definir fonte contábil oficial de despesas e renegociações.
3. Validar reconciliação PIX com dados anonimizados.
4. Adicionar índices somente em sprint de migration autorizada, se o `EXPLAIN` justificar.
5. Desenvolver o frontend em fase separada.
