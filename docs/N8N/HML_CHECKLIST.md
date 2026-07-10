# Checklist de Homologação n8n

Preencher sem copiar valores de credenciais, certificados ou dados pessoais.

## Identificação

- Data/janela: __________
- Commit/versão dos JSONs: __________
- Versão n8n: __________
- Operador: __________
- Aprovador técnico: __________
- Aprovador financeiro: __________

## Infraestrutura e segurança

- [ ] Projeto identificado como HML.
- [ ] Timezone `America/Sao_Paulo`.
- [ ] Controle de acesso, auditoria e retenção revisados.
- [ ] Egress limitado a destinos HML aprovados.
- [ ] Allowlist de destinatários sintéticos ativa.
- [ ] Nenhum valor secreto presente em JSON, documentação ou evidência.
- [ ] Backup/export anterior armazenado e verificado.

## Variáveis e credenciais

- [ ] `J12_API_URL` aponta para HML e não contém credencial.
- [ ] `BOTCONVERSA_URL` aponta para sandbox/HML e não contém credencial.
- [ ] `WHATSAPP_PROVIDER`, `LOG_LEVEL` e `RETRY_LIMIT` revisados conforme consumidores.
- [ ] Ambiente Banco Inter identificado como não produtivo, caso aplicável.
- [ ] Credencial API J12 criada no cofre, com menor privilégio e expiração.
- [ ] Credenciais Banco Inter permanecem sem vínculo enquanto não houver consumidor.
- [ ] Credenciais BotConversa/WhatsApp são de sandbox/HML.
- [ ] Proprietário, rotação e revogação registrados para cada credencial.

## Importação e testes

- [ ] JSONs validados antes da importação.
- [ ] Cinco workflows importados com `active=false`.
- [ ] Quantidades de nós/conexões conferidas com `WORKFLOW_DEPENDENCIES.md`.
- [ ] Tipos de nós reconhecidos pela versão do n8n.
- [ ] Credenciais vinculadas apenas aos nós consumidores.
- [ ] Casos feliz, vazio, inválido, indisponível e repetido registrados.
- [ ] Logs/evidências não expõem segredos nem dados pessoais desnecessários.
- [ ] Idempotência e efeito único aprovados.
- [ ] Quatro envelopes vazios marcados `BLOQUEADO` para ativação.

## Autorização de ativação

- [ ] Todos os gates do candidato estão aprovados.
- [ ] Aprovação técnica registrada.
- [ ] Aprovação financeira registrada.
- [ ] Janela de observação e responsável definidos.
- [ ] Somente um workflow será ativado por vez.
- [ ] Produção permanece fora de escopo.

Decisão: [ ] APROVADO HML  [ ] REPROVADO  [ ] BLOQUEADO

Workflow autorizado: __________

## Checklist de rollback

- [ ] Workflow afetado desativado.
- [ ] Novos gatilhos interrompidos e reprocessador não acionado.
- [ ] Execuções em andamento avaliadas antes de cancelar.
- [ ] IDs, horários, último nó e efeitos preservados.
- [ ] Credencial revogada/rotacionada quando necessário.
- [ ] Itens classificados como concluído, falhou, não processado ou desconhecido.
- [ ] Duplicidades e efeitos parciais reconciliados.
- [ ] Última versão aprovada restaurada com `active=false`.
- [ ] Caso sintético e repetição idempotente aprovados.
- [ ] Incidente e decisão final registrados.

Resultado do rollback: __________
