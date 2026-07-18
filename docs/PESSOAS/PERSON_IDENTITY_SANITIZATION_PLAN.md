# Plano Controlado de Saneamento de Identidade

## Regra central

Este plano não é um executor. Nenhuma correção, merge, exclusão, backfill ou alteração de schema foi implementada na Sprint 27.17A.3. Qualquer ação futura exige diagnóstico aprovado, backup, ambiente confirmado, revisão humana dos conflitos e rollout reversível.

## Classes de tratamento

### Candidatas a correção automática futura

Somente depois de aprovação e em migration/job próprio:

- CPF aceito pelo contrato, cuja única diferença seja ponto, hífen ou espaço;
- e-mail sintaticamente aceito cuja única diferença seja `trim` ou caixa;
- telefone aceito pelo contrato cuja diferença seja apenas espaço, parênteses, ponto ou hífen, preservando `+` inicial.

Mesmo nesses casos, a ação futura deve gravar primeiro em coluna normalizada aditiva, comparar resultados e nunca sobrescrever o valor original durante o primeiro rollout.

### Correção assistida obrigatória

- duas ou mais Pessoas com o mesmo CPF normalizado;
- CPF inválido, excedente ou com caracteres não suportados;
- múltiplos perfis da mesma Pessoa e tipo, sobretudo ativos;
- estados divergentes em perfis duplicados;
- possível mistura entre dados de aluno e responsável;
- contato compartilhado cuja titularidade precise ser entendida;
- registros aceitos apenas pelo mapper legado ou sujeitos a truncamento.

### Proibidas para automação

- escolher registro principal, mesclar Pessoas ou excluir registro;
- substituir CPF ou inferir documento;
- inferir/adicionar DDI ou DDD;
- remover e-mail/telefone compartilhado;
- usar nome, nascimento, sexo ou endereço como chave automática;
- declarar e-mail ou telefone exclusivo;
- resolver divergência por “registro mais recente”.

## Formato seguro de plano futuro

```json
{
  "planVersion": "1",
  "generatedAt": "ISO-8601",
  "sourceContractVersion": "1.0.0",
  "summary": {},
  "actions": [
    {
      "actionType": "HUMAN_REVIEW_REQUIRED",
      "personIds": ["internal-id"],
      "field": "cpf",
      "severity": "CRITICAL",
      "requiresHumanApproval": true,
      "reversible": false,
      "reason": "DUPLICATE_STRONG_IDENTIFIER"
    }
  ]
}
```

O plano não deve carregar valores originais, valores normalizados, nomes ou contatos. Não há fingerprint porque o projeto não possui mecanismo oficial aprovado para identidade.

## Sequência operacional futura

1. Executar diagnóstico somente leitura em ambiente explicitamente autorizado.
2. Registrar apenas métricas agregadas e IDs internos indispensáveis.
3. Congelar a versão do contrato usada no diagnóstico.
4. Revisar manualmente todos os grupos críticos e altos.
5. Definir regra oficial para CPF global, CPF ausente e Pessoa Jurídica.
6. Criar backup e ensaio em cópia controlada.
7. Adicionar colunas normalizadas nullable, sem unique inicial.
8. Fazer backfill em lotes pequenos, reiniciáveis e auditáveis.
9. Comparar métricas antes/depois; conflitos permanecem sem preenchimento ou bloqueados.
10. Somente após zero conflito impeditivo, avaliar índice único de CPF normalizado.
11. Preservar e-mail/telefone como contatos não exclusivos.
12. Disponibilizar rollback que desative leitura nova antes de remover qualquer estrutura.

## Gates para Sprint 27.17A.4

- ambiente e schema vivo confirmados por `SHOW CREATE TABLE`/`SHOW INDEX`;
- relatório completo dentro do limite ou estratégia de execução particionada aprovada;
- grupos de CPF duplicado revisados e decisão registrada;
- regra de escopo do CPF aprovada;
- política explícita para CPF nulo/inválido e PJ;
- perfis duplicados classificados;
- nenhum valor sujeito a truncamento silencioso no backfill;
- plano de rollout, observabilidade e rollback aprovado;
- nenhuma unicidade proposta para e-mail ou telefone.

## Resultado estrutural da Sprint 27.17A.4

A Sprint A.4 implementou as colunas nullable `cpf_normalized`, `email_normalized`,
`telefone_normalized` e `celular_normalized`, com índices comuns e backfill
JavaScript idempotente. A unicidade de CPF permaneceu bloqueada porque o escopo
de negócio e os conflitos do banco vivo não foram aprovados. Este plano continua
obrigatório antes de qualquer unique, merge ou resolvedor concorrente.
