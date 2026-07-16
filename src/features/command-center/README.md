# Centro de Comando

Base isolada da futura refatoração do Dashboard administrativo.

## Estado atual

Os arquivos desta pasta ainda não são importados por rotas ou componentes em
runtime. A estrutura foi criada para permitir uma migração incremental sem
alterar o Dashboard existente.

## Organização

- `components/`: primitives visuais reutilizáveis e sem acesso a APIs.
- `hooks/`: estado de interface independente das fontes de dados.
- `types/`: contratos de apresentação do Centro de Comando.

## Regras de integração futura

1. A rota atual continuará responsável por autenticação, autorização visual e
   redirecionamentos.
2. Hooks de BI existentes continuarão responsáveis pelas consultas.
3. Adapters futuros converterão contratos BI em `CommandCenterMetric`.
4. Componentes desta feature receberão dados por propriedades e não executarão
   regras de negócio.
5. A migração dos widgets será gradual e deverá preservar a composição visual
   atual até a homologação de cada bloco.
