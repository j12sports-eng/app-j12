import { createRequire } from "node:module";

const backendRequire = createRequire(new URL("../../backend/package.json", import.meta.url));
const authRoutes = backendRequire("./src/routes/auth.routes.js");

export default authRoutes?.default ?? authRoutes;
