# Sprint 21.7 - BI de Quadras e Locações

## Contrato e segurança

Base: `0dd21c9`. Endpoint administrativo `GET /api/admin/bi/courts`, protegido em sequência por `requireAuth` e `canManageSystem`. Frontend em `/admin/bi/quadras`, restrito a `admin` e `coordenador`.

## Fontes e semântica

As únicas fontes são `j12_quadras` (nome operacional, unidade, status e `funcionamento_json`) e `j12_quadra_reservas` (ocorrências, período, status, pagamento e vínculo financeiro). O repository é read-only, faz duas consultas parametrizadas em paralelo, não possui N+1 e não consulta dados do locatário.

Status canônicos do domínio: `pending`, `confirmed`, `cancelled`, `completed` e `waitlisted`. O total operacional exibido nos rankings considera `confirmed` e `completed`; `cancelled` alimenta cancelamentos e não ocupa. `pending` e `waitlisted` não ocupam. Cada linha/`reservation.id` é uma ocorrência; `recurrence_group_id` apenas relaciona ocorrências materializadas e não causa agrupamento ou multiplicação.

Somente quadras `ativa` contribuem capacidade. As janelas usam as chaves canônicas `dom`, `seg`, `ter`, `qua`, `qui`, `sex`, `sab`. Horas reservadas são recortadas ao período e intervalos sobrepostos/consecutivos são unidos por quadra. Assim, duas quadras nunca se anulam e uma sobreposição na mesma quadra não duplica minutos. Horas disponíveis representam a capacidade das janelas de funcionamento; taxa = minutos ocupados únicos / minutos de capacidade, sem resultado negativo. Não há fonte de exceções de funcionamento nas duas tabelas autorizadas, portanto bloqueios e feriados não são abatidos nesta versão.

O timezone é `America/Sao_Paulo`, reutilizado do núcleo de BI. DATETIME sem offset é interpretado nesse timezone; limites customizados são inclusivos e ocorrências são recortadas ao intervalo.

## Receita e limitações

Receita e ticket médio são explicitamente indisponíveis (`NO_CANONICAL_PAYMENT_AMOUNT_AND_TIMESTAMP`). Embora `payment_status = 'paid'` seja canônico e `final_value` seja o total calculado ao criar a reserva, a reserva não persiste timestamp de pagamento e seu valor pode mudar em reagendamento posterior. `financial_charge_id` também pode ser nulo em reservas legítimas. Logo, não é possível provar no recorte simultaneamente data e valor efetivamente recebidos. A cobrança `tipo = 'locacao_quadra'` não é consultada nem somada, evitando dupla contagem e acoplamento ao Financeiro.

Métricas disponíveis: cancelamentos, horas de capacidade, horas ocupadas únicas, taxa de ocupação e rankings por quadra, horário, dia e unidade. Receita e ticket médio ficam indisponíveis, nunca zero fictício. O ranking por horário/dia é uma agregação real e não é chamado de heatmap.

## Privacidade

O payload é agregado e retorna apenas identificadores/nomes operacionais de quadra e unidade. Não retorna nome, CPF, telefone, e-mail ou endereço de locatário, nem Pix payload, QR Code, txid, e2eid, token, certificado, credencial ou dado bancário. Nenhum arquivo de Quadras, Financeiro, Payment, Banco Inter, automações ou reservas foi alterado. A Sprint 21.8 não foi iniciada.
