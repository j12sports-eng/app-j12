const bcrypt = require("bcryptjs");
const { pool } = require("../src/config/db.js");

async function criarUsuarios() {
  try {
    console.log("🔄 Criando usuários completos J12...");

    const senhaPadrao = "123456";
    const senha_hash = await bcrypt.hash(senhaPadrao, 10);

    // 🔹 1. Criar um aluno (se não existir)
    const [alunos] = await pool.query("SELECT id FROM j12_alunos LIMIT 1");

    let alunoId;

    if (alunos.length > 0) {
      alunoId = alunos[0].id;
    } else {
      const [novoAluno] = await pool.query(
        `
        INSERT INTO j12_alunos (nome_completo, email_contato, status)
        VALUES ('Aluno Teste J12', 'aluno@teste.com', 'ativo')
        `,
      );
      alunoId = novoAluno.insertId;
    }

    // 🔹 Função para inserir usuário
    async function upsertUsuario({ nome, email, perfil, aluno_id = null }) {
      await pool.query(
        `
        INSERT INTO j12_usuarios (nome, email, senha_hash, perfil, aluno_id, status)
        VALUES (?, ?, ?, ?, ?, 'ativo')
        ON DUPLICATE KEY UPDATE
          nome = VALUES(nome),
          senha_hash = VALUES(senha_hash),
          perfil = VALUES(perfil),
          aluno_id = VALUES(aluno_id),
          status = 'ativo'
        `,
        [nome, email, senha_hash, perfil, aluno_id],
      );
    }

    // 🔥 Criando usuários

    await upsertUsuario({
      nome: "Admin J12",
      email: "admin@j12.com",
      perfil: "admin",
    });

    await upsertUsuario({
      nome: "Coordenação J12",
      email: "coord@j12.com",
      perfil: "admin",
    });

    await upsertUsuario({
      nome: "Professor J12",
      email: "prof@j12.com",
      perfil: "professor",
    });

    await upsertUsuario({
      nome: "Responsável J12",
      email: "responsavel@j12.com",
      perfil: "responsavel",
    });

    await upsertUsuario({
      nome: "Aluno J12",
      email: "aluno@j12.com",
      perfil: "aluno",
      aluno_id: alunoId,
    });

    console.log("✅ Usuários criados com sucesso!");
    console.log("📧 Emails:");
    console.log("admin@j12.com");
    console.log("coord@j12.com");
    console.log("prof@j12.com");
    console.log("responsavel@j12.com");
    console.log("aluno@j12.com");
    console.log("🔑 Senha padrão: 123456");

    process.exit(0);
  } catch (err) {
    console.error("❌ Erro ao criar usuários:", err);
    process.exit(1);
  }
}

criarUsuarios();
