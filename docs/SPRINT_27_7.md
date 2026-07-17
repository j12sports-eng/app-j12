# Sprint 27.7 — Preview Read-Only de Turmas

## Objetivo e estado inicial

Integrar Turmas ao Centro de Comando usando apenas uma fonte agregada existente. O preflight foi aprovado na branch `sprint-23`, com worktree limpo, typecheck, lint e builds client/SSR válidos.

## Auditoria e fonte selecionada

O frontend operacional usa `src/routes/turmas.tsx` e o store legado. O backend possui rotas CRUD legadas e um domínio Classes read-only. Para o preview foi selecionado exclusivamente `GET /admin/bi/classes`, contrato `21.5`, marcado `readOnly: true`.

A rota BI exige `requireAuth` e `canManageSystem`. O filtro de unidade é normalizado pela fundação BI e aplicado por parâmetro em `turma.unidade_id`. A interface não aceita tenant ou unidade arbitrários.

O repository BI executa duas consultas parametrizadas em paralelo: uma agrega ocupação por turma e outra conta alunos matriculados distintos. Os testes existentes comprovam ausência de N+1, vínculos ativos, matrículas ativas e exclusão lógica.

## Indicadores implementados

- Turmas ativas.
- Vagas disponíveis.
- Turmas lotadas.
- Taxa de ocupação.
- Turmas subutilizadas.
- Datas de geração e atualização.

Não foram implementados total geral, turmas inativas, turmas sem professor ou frequência. Capacidade total e alunos matriculados existem no contrato BI original, mas não pertencem ao contrato compartilhado atual do Centro de Comando e não foram adicionados para preservar contratos públicos.

## Arquitetura vertical

```text
ClassesCommandCenterPreview
→ useClassesBI
→ classesPreviewProvider
→ normalizeClassesPreviewSource
→ createClassesProvider / adaptClassesContract
→ getBiClasses
→ GET /admin/bi/classes
```

São reutilizados `PreviewShell`, `PreviewField`, `PreviewReloadButton`, `PreviewStatePanel`, query options, hook, provider, adapter, tipos compartilhados e registry.

## Contrato e privacidade

O normalizador aceita somente números finitos e não negativos, marca campos inválidos como indisponíveis, assegura datas com fallback e nunca propaga a tabela operacional. `data.classes` permanece vazio, eliminando nomes de turma, professor, IDs e linhas detalhadas do contrato do preview. A taxa de ocupação é usada somente quando fornecida e marcada como disponível pela fonte.

## Estados

O preview trata loading inicial, refresh com bloqueio de reload simultâneo, empty, erro inicial com recarga, erro de refresh preservando dados anteriores e success somente com métricas válidas.

## Segurança e performance

O fluxo usa apenas GET. Não cria, edita ou exclui turmas; não altera capacidade, professor ou matrícula; não chama financeiro; não expõe aluno, CPF, telefone, e-mail ou endereço; e não registra dados sensíveis. Há uma chamada HTTP com query key estável e stale time de dois minutos. Nenhuma listagem é agregada no navegador.

## Testes e validação

Os testes cobrem contrato real, payload parcial, números e taxa inválidos, data inválida, vazio, estados da interface, reload, GET-only, ausência de mutações e PII, descarte das linhas operacionais, registry e regressão dos previews existentes. Também são executados os testes existentes do BI Classes para service, controller, frontend e repository.

## Limitações e próximo passo

O endpoint original ainda transporta uma tabela operacional, embora o preview a descarte imediatamente. Uma evolução futura pode oferecer uma variante summary menor, mas não é necessária para a correção funcional atual. Novos indicadores devem ser adicionados somente após evolução explícita e compatível do contrato compartilhado.
