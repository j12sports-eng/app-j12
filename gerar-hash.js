import bcrypt from "bcryptjs";

// Nunca mantenha password operacional no codigo; forneca a entrada pelo ambiente.
const senha = String(process.env.HASH_PASSWORD_INPUT || "");

if (!senha) {
  throw new Error("HASH_PASSWORD_INPUT nao configurado.");
}

const hash = bcrypt.hashSync(senha, 10);

console.log("Hash:", hash);
