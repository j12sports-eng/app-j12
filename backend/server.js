// HML must fail before loading the application or outbound integration clients.
if (String(process.env.J12_ENVIRONMENT || "").toLowerCase() === "hml") {
  require("../scripts/hml/hml-core.cjs").assertValidHmlEnvironment(process.env);
}

console.log("[START] server.js executou");

require("./src/server.js");
