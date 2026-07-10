const { BiReadRepositoryContract } = require("../../application/index.js");

const CHAMPIONSHIPS_SQL = `SELECT id,name,category,modality,start_date,end_date,status
FROM j12_campeonatos
WHERE deleted_at IS NULL AND status <> 'REMOVED'
AND start_date <= ? AND end_date >= ?
ORDER BY start_date,id`;
const REGISTRATIONS_SQL = `SELECT r.id,r.championship_id,r.team_id,r.status,r.created_at,c.name championship_name,c.category
FROM j12_campeonato_inscricoes r
INNER JOIN j12_campeonatos c ON c.id=r.championship_id AND c.deleted_at IS NULL AND c.status <> 'REMOVED'
WHERE r.deleted_at IS NULL AND r.created_at < DATE_ADD(?,INTERVAL 1 DAY) AND r.created_at >= ?
ORDER BY r.created_at,r.id`;
const PARTICIPANTS_SQL = `SELECT COUNT(*) participants
FROM j12_campeonato_inscricao_atletas p
INNER JOIN j12_campeonato_inscricoes r ON r.id=p.registration_id AND r.deleted_at IS NULL AND r.status='CONFIRMED'
INNER JOIN j12_campeonatos c ON c.id=r.championship_id AND c.deleted_at IS NULL AND c.status <> 'REMOVED'
WHERE p.active=1 AND r.created_at < DATE_ADD(?,INTERVAL 1 DAY) AND r.created_at >= ?`;
const MATCHES_SQL = `SELECT m.id,m.championship_id,m.match_date,m.status,c.name championship_name,c.category
FROM j12_campeonato_jogos m
INNER JOIN j12_campeonatos c ON c.id=m.championship_id AND c.deleted_at IS NULL AND c.status <> 'REMOVED'
WHERE m.match_date BETWEEN ? AND ?
ORDER BY m.match_date,m.id`;

class MySqlBiChampionshipsRepository extends BiReadRepositoryContract {
  constructor(options = {}) {
    super();
    this.query = options.queryRunner || defaultQuery();
  }

  async getChampionshipAnalytics({ current }) {
    const period = [current.endDate, current.startDate];
    const [championships, registrations, participants, matches] = await Promise.all([
      this.query(CHAMPIONSHIPS_SQL, period),
      this.query(REGISTRATIONS_SQL, period),
      this.query(PARTICIPANTS_SQL, period),
      this.query(MATCHES_SQL, [current.startDate, current.endDate]),
    ]);
    return {
      championships: rows(championships),
      matches: rows(matches),
      participants: Number(rows(participants)[0]?.participants || 0),
      registrations: rows(registrations),
    };
  }
}

function rows(result) {
  if (!Array.isArray(result)) return [];
  return Array.isArray(result[0]) ? result[0] : result;
}
function defaultQuery() {
  return require("../../../../config/db.js").query;
}
module.exports = {
  CHAMPIONSHIPS_SQL,
  MATCHES_SQL,
  MySqlBiChampionshipsRepository,
  PARTICIPANTS_SQL,
  REGISTRATIONS_SQL,
};
