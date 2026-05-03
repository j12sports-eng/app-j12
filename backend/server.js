console.log("🔥 server.js executou");

const { startServer } = require("./src/server");

startServer()
  .then(() => {
    console.log("✅ startServer finalizado");
  })
  .catch((error) => {
    console.error("❌ Erro ao iniciar API:", error);
    process.exit(1);
  });
