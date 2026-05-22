import bcrypt from "bcryptjs";

const senha = "J12@2026";

const hash = bcrypt.hashSync(senha, 10);

console.log("Senha:", senha);
console.log("Hash:", hash);
