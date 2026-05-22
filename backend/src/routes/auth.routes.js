const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { query } = require("../config/db");

router.post("/login", async (req, res) => {
  try {
    const { email, senha } = req.body;

    // 🔒 validação básica
    if (!email || !senha) {
      return res.status(400).json({ message: "Email e senha são obrigatórios" });
    }

    const users = await query("SELECT * FROM j12_usuarios WHERE email = ? LIMIT 1", [email]);

    if (!users.length) {
      return res.status(401).json({ message: "Usuário não encontrado" });
    }

    const user = users[0];

    // 🔒 valida senha
    const senhaValida = await bcrypt.compare(senha, user.senha_hash);

    if (!senhaValida) {
      return res.status(401).json({ message: "Senha inválida" });
    }

    // 🔥 TOKEN (ESSENCIAL pro painel funcionar)
    console.log("USER LOGIN:", user);

    const token = jwt.sign(
      {
        id: user.id,
        role: user.perfil,
        perfil: user.perfil,
        aluno_id: user.aluno_id,
      },
      "J12_SECRET",
      { expiresIn: "7d" },
    );

    res.json({
      token,
      user: {
        id: user.id,
        nome: user.name,
        role: user.perfil,
        perfil: user.perfil,
      },
    });
  } catch (err) {
    console.error("Erro no login:", err);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
});

module.exports = router;
