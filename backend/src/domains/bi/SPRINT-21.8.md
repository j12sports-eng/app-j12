# Sprint 21.8 - BI de Campeonatos e Eventos

Endpoint administrativo `GET /api/admin/bi/championships`, protegido pelo router de BI com `requireAuth` e `canManageSystem`. Frontend em `/admin/bi/campeonatos`, restrito a `admin` e `coordenador`.

Fontes canônicas read-only: `j12_campeonatos`, `j12_campeonato_inscricoes`, `j12_campeonato_inscricao_atletas` e `j12_campeonato_jogos`. O repository não executa `ensureSchema`, escrita ou regra competitiva.

Status de campeonato: `DRAFT`, `PUBLISHED`, `ARCHIVED`, `REMOVED`. Ativos são `PUBLISHED`; realizados são `ARCHIVED`; removidos e registros com `deleted_at` não entram. Inscrições/equipes usam somente `CONFIRMED`. Participantes contam atletas `active = 1` de inscrições confirmadas. Partidas realizadas usam `FINISHED`; pendentes usam `SCHEDULED` e `POSTPONED`; `CANCELLED` não entra nesses grupos.

Métricas disponíveis: campeonatos ativos/realizados, inscrições confirmadas, equipes únicas inscritas, participantes, partidas realizadas/pendentes, média de equipes, distribuição por categoria, evolução diária de inscrições e ranking administrativo por competição. O período usa `America/Sao_Paulo` via infraestrutura compartilhada do BI.

Receita de inscrição é indisponível (`NO_CANONICAL_REGISTRATION_REVENUE`): as fontes auditadas não persistem taxa, cobrança ou pagamento de inscrição. Nenhum zero financeiro fictício é retornado.

O payload não retorna nome, documento ou nascimento de atleta, responsáveis de equipe ou qualquer dado financeiro sensível. O domínio Campeonatos, suas regras competitivas e o Portal Público permanecem inalterados. A Sprint 21.9 não foi iniciada.
