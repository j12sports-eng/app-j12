const db = require("../../db");

async function listarUnidades(req, res) {
  try {
    const [rows] = await db.query("SELECT * FROM j12_unidades");
    res.json(rows);
  } catch (err) {
    console.error("Erro unidades:", err);
    res.status(500).json({ message: "Erro ao buscar unidades" });
  }
}

module.exports = {
  listarUnidades,
};
