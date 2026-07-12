const express = require("express");
const bcrypt = require("bcryptjs");
const { query } = require("../config/db.js");
const { signJwt } = require("../utils/jwt.js");

const router = express.Router();

// Rota legada mantida para compatibilidade. A emissao usa a infraestrutura JWT canonica.
router.post("/login", async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ message: "Email e senha sao obrigatorios" });
    }

    const users = await query("SELECT * FROM j12_usuarios WHERE email = ? LIMIT 1", [email]);
    if (!users.length) {
      return res.status(401).json({ message: "Usuario nao encontrado" });
    }

    const user = users[0];
    const senhaValida = await bcrypt.compare(senha, user.senha_hash);
    if (!senhaValida) {
      return res.status(401).json({ message: "Senha invalida" });
    }

    const token = signJwt({
      sub: user.id,
      id: user.id,
      role: user.perfil,
      perfil: user.perfil,
      aluno_id: user.aluno_id,
    });

    return res.json({
      token,
      user: { id: user.id, nome: user.name, role: user.perfil, perfil: user.perfil },
    });
  } catch {
    return res.status(500).json({ message: "Erro interno no servidor" });
  }
});

module.exports = router;
