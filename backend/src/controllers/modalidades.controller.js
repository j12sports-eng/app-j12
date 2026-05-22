const db = require("../../db");

async function listarModalidades(req, res) {
  try {
    const rows = await db.query("SELECT * FROM j12_modalidades");
    res.json(rows);
  } catch (err) {
    console.error("Erro modalidades:", err);
    res.status(500).json({ message: "Erro ao buscar modalidades" });
  }
}

module.exports = {
  listarModalidades,
};
