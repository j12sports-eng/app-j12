# Sprint 6.2 - Repository

Criacao inicial da camada Repository em um modulo de menor risco, sem alterar comportamento do App J12.

## Indice

- [Objetivo](#objetivo)
- [Modulo Escolhido](#modulo-escolhido)
- [Arquivos Alterados](#arquivos-alterados)
- [Consultas Movidas](#consultas-movidas)
- [Services Preservados](#services-preservados)
- [Garantias de Compatibilidade](#garantias-de-compatibilidade)
- [Riscos](#riscos)
- [Auditoria](#auditoria)
- [Proximos Passos](#proximos-passos)

## Objetivo

Preparar a camada Repository extraindo apenas acesso ao banco de um service existente, sem alterar endpoints, respostas da API, autenticação, banco, SQL, frontend ou regra de negocio.

## Modulo Escolhido

O modulo `Alunos` foi descartado nesta Sprint porque a auditoria arquitetural classifica Cadastros/Alunos/Responsaveis como critico. Ele possui dependencias com usuarios, financeiro, contratos, dashboard, agenda e portais.

Foi escolhida uma fatia pequena do modulo `Notificacoes`, especificamente `backend/src/services/notificacao.service.js`, pelos seguintes motivos:

- Possui uma unica funcao publica exportada: `criarNotificacao`.
- Possui somente duas operacoes de banco.
- Nao altera rotas nem controllers.
- Nao altera payload de entrada ou saida.
- A regra de negocio de evitar notificacao duplicada no mesmo dia permanece no service.

## Arquivos Alterados

| Arquivo | Tipo | Descricao |
| --- | --- | --- |
| `backend/src/services/notificacao.service.js` | Alterado | Passou a chamar o repository para acesso ao banco, mantendo a assinatura `criarNotificacao({ alunoId, titulo, mensagem, tipo })`. |
| `backend/src/repositories/notificacao.repository.js` | Criado | Novo repository com as consultas SQL que antes estavam diretamente no service. |
| `docs/BACKEND/SPRINT_6_2.md` | Criado | Documentacao da Sprint 6.2. |

## Consultas Movidas

Foram movidas para `backend/src/repositories/notificacao.repository.js`:

### Consulta de duplicidade

Funcao criada:

```js
findDuplicateNotificationForToday({ alunoId, titulo, mensagem })
```

SQL preservado:

```sql
SELECT id
FROM j12_notificacoes
WHERE aluno_id = ?
AND titulo = ?
AND mensagem = ?
AND DATE(created_at) = CURDATE()
LIMIT 1
```

### Insercao de notificacao

Funcao criada:

```js
insertNotification({ alunoId, titulo, mensagem, tipo })
```

SQL preservado:

```sql
INSERT INTO j12_notificacoes (
  aluno_id,
  titulo,
  mensagem,
  tipo,
  lida,
  created_at
)
VALUES (?, ?, ?, ?, 0, NOW())
```

## Services Preservados

O service `backend/src/services/notificacao.service.js` continua responsavel por:

- Expor `criarNotificacao`.
- Receber o mesmo objeto de entrada.
- Aplicar o valor padrao `tipo = "info"`.
- Verificar se a consulta retornou registro duplicado.
- Retornar `null` quando ja existe notificacao equivalente no mesmo dia.
- Retornar o resultado do insert quando a notificacao e criada.

Nenhum outro service foi alterado.

## Garantias de Compatibilidade

Durante esta Sprint:

- Nenhum endpoint foi alterado.
- Nenhuma rota foi alterada.
- Nenhum controller foi alterado.
- Nenhuma resposta da API foi alterada.
- Nenhum SQL foi alterado.
- Nenhuma tabela foi alterada.
- Nenhuma migration foi criada.
- Nenhuma regra de negocio foi movida para o repository.
- Nenhum import externo de consumidores do service foi alterado.
- Nenhum arquivo frontend foi alterado.

## Riscos

| Risco | Classificacao | Mitigacao |
| --- | --- | --- |
| Regressao por erro de import interno no service. | Baixo | Validar `require` do service e build do projeto. |
| Divergencia acidental de SQL. | Baixo | SQL foi copiado sem alteracao semantica. |
| Confundir repository com camada de regra de negocio. | Baixo | Repository contem apenas funcoes de consulta; regra de duplicidade permanece no service. |

Nao foi identificado risco que exigisse interromper a implementacao, porque a alteracao ficou restrita a um service pequeno, sem alterar contrato publico ou endpoint.

## Auditoria

Validacoes previstas:

- `node --check backend/src/repositories/notificacao.repository.js`
- `node --check backend/src/services/notificacao.service.js`
- Carregamento por `require` do service.
- `npm run build`
- Revisao de diff para confirmar que rotas, controllers, endpoints, frontend e banco nao foram alterados.

## Proximos Passos

Proximas extracoes de repository devem seguir o mesmo criterio:

1. Escolher somente um modulo por Sprint.
2. Rejeitar modulos criticos como Alunos, Auth e Financeiro ate haver cobertura de testes.
3. Mover apenas queries.
4. Preservar regra de negocio no service.
5. Manter assinatura publica intacta.
