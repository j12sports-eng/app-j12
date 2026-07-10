# Modelo de Credenciais para HML

## Regras de preenchimento

Este arquivo registra metadados, nunca valores secretos. Preencher os campos no sistema de gestão de segredos/cofre do n8n, não neste documento.

- Não colar valor de autenticação, senha, chave privada ou conteúdo de certificado.
- Não incluir segredo em URL, nome da credencial, evidência ou log.
- Usar menor privilégio, expiração, rotação e proprietário identificados.
- Separar HML de produção e impedir reutilização cruzada.

## Registro por credencial

| Campo | Preenchimento permitido |
| --- | --- |
| Nome no n8n | identificador descritivo terminado em `HML` |
| Sistema | API J12, Banco Inter, BotConversa ou WhatsApp Provider |
| Tipo n8n | tipo da credencial, sem conteúdo sensível |
| Proprietário | equipe ou papel responsável |
| Escopos | permissões mínimas concedidas |
| Ambiente | `HML` ou `SANDBOX` |
| Criada/expira | datas, sem valores de autenticação |
| Rotação/revogação | procedimento e responsável |
| Consumidores | nomes dos workflows/nós autorizados |
| Validação | data, executor e resultado, sem valor secreto |

## API J12

- Nome recomendado: `J12 Automation Service HML`.
- Consumidor atual: nós HTTP de `financeiro-lembretes`.
- Tipo esperado no JSON atual: autenticação por cabeçalho gerenciada pelo n8n.
- Escopo mínimo: consultar vencimentos e registrar eventos de automação em HML.
- Validar: autenticação, autorização mínima, expiração, revogação e resposta sem dados excessivos.

## Banco Inter

- Nome recomendado: `Banco Inter HML`.
- Consumidor atual: nenhum nó nos JSONs entregues.
- Material previsto: identificador do cliente e material mTLS, todos no cofre seguro.
- Validar: ambiente de homologação, vínculo da conta de teste, expiração e cadeia do certificado.
- Gate: não criar vínculo com workflow enquanto não existir nó consumidor autorizado.

## BotConversa

- Nome recomendado: `BotConversa API HML`.
- Consumidor atual: nó `HTTP Enviar WhatsApp` de `financeiro-lembretes`.
- Tipo esperado: autenticação HTTP gerenciada pelo n8n.
- Validar: workspace sandbox/HML, allowlist, limite de envio, expiração e revogação.

## WhatsApp Provider

- Nome recomendado: `WhatsApp Provider HML`.
- Consumidor atual: nenhum nó com essa credencial nos JSONs entregues.
- Validar: conta sandbox, números de teste, templates aprovados, limite e revogação.
- Gate: não vincular até existir consumidor e plano de teste aprovado.

## Inventário para preenchimento externo

| Credencial | Criada no cofre | Proprietário | Expiração revisada | Consumidor validado | Status |
| --- | --- | --- | --- | --- | --- |
| API J12 HML | [ ] | __________ | [ ] | [ ] | __________ |
| Banco Inter HML | [ ] | __________ | [ ] | [ ] | __________ |
| BotConversa HML | [ ] | __________ | [ ] | [ ] | __________ |
| WhatsApp Provider HML | [ ] | __________ | [ ] | [ ] | __________ |

## Evidência segura

Registrar apenas nome da credencial, ID interno não sensível quando permitido, data, operador e resultado do teste. Capturas devem ocultar todos os valores e dados pessoais.
