const { startServer } = require("./src/server");

startServer().catch((error) => {
  console.error("Falha ao iniciar a API J12:", error);
  process.exit(1);
});
