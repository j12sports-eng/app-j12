# Sprint 27.11 — Preview de Eventos

## Resultado

A Sprint 27.11 foi encerrada com **bloqueio seguro**. A auditoria não encontrou uma fonte agregada, canônica e somente leitura para o domínio de Eventos. Por isso, nenhum preview funcional foi criado e nenhum dado operacional foi adaptado ou exposto no Centro de Comando.

## Estado inicial auditado

- Worktree limpo no início da sprint.
- Branch: `sprint-23`.
- HEAD: `800be5b feat(command-center): integra preview read-only de campeonatos`.
- `npm run typecheck`: aprovado.
- `npm run lint:command-center`: aprovado.
- `npm run build`: aprovado para client e SSR.
- Testes da infraestrutura do Centro de Comando: 38 aprovados.

## Auditoria da fonte de Eventos

Não existem no frontend ou no backend:

- módulo de BI de Eventos;
- endpoint administrativo agregado de Eventos;
- contrato versionado de Eventos;
- garantia `readOnly` específica do domínio;
- filtros, regras de autorização ou isolamento documentados para Eventos;
- KPIs, distribuições, séries temporais ou rankings agregados de Eventos.

As ocorrências encontradas não podem ser tratadas como uma fonte canônica:

- o KPI `events` do Centro de Comando é apenas um indicador reservado de configuração, sem fonte de dados;
- itens `EVENT` da Agenda representam registros operacionais e escopados, não um agregado analítico de Eventos;
- eventos de notificações, automações, webhooks e aplicação têm semântica técnica diferente;
- eventos de partidas de campeonatos são operacionais, podem conter dados de atletas e pertencem ao domínio de Campeonatos;
- o material de BI que menciona “Campeonatos e Eventos” implementa métricas específicas de campeonatos e já é consumido pelo preview correspondente; ele não define um domínio independente de Eventos.

Usar qualquer uma dessas fontes exigiria criar semântica nova, enumerar linhas operacionais ou potencialmente expor PII. Isso violaria os limites de segurança e de somente leitura da sprint.

## Decisão de arquitetura

Nenhuma fonte foi selecionada. Consequentemente, não foram criados:

- cliente de API ou tipos de BI de Eventos;
- contrato, adapter, provider ou hook de Eventos;
- normalizador ou componente de preview;
- registro no catálogo de previews;
- rota administrativa de preview;
- endpoint, serviço, controller, query ou arquivo backend.

Os previews existentes permanecem inalterados.

## Condições para desbloqueio

Uma sprint backend separada deve primeiro definir e validar:

1. o significado canônico do domínio de Eventos e sua fronteira em relação a Agenda e Campeonatos;
2. uma fonte agregada que não enumere linhas operacionais nem exponha PII;
3. um endpoint administrativo `GET`, explicitamente `readOnly` e versionado;
4. filtros permitidos, autenticação, autorização e isolamento por unidade/tenant;
5. KPIs e dimensões suportados pela fonte real, sem métricas inventadas;
6. testes de contrato, segurança, isolamento e desempenho.

Somente depois dessas garantias o Preview de Eventos poderá ser integrado ao Centro de Comando.

## Escopo preservado

- Nenhuma operação de escrita foi introduzida.
- Nenhuma chamada de API de Eventos foi criada.
- Nenhuma PII ou linha operacional foi encaminhada a preview.
- Nenhum arquivo backend foi alterado.
- Nenhum preview anterior foi modificado ou removido.
