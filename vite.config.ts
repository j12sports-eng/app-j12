import { defineConfig, type PluginOption } from "vite";

const allowedHosts = ["app.j12sports.com.br"];
const defaultApiTarget = "http://127.0.0.1:3001";

function resolveDevApiTarget() {
  const configured = String(process.env.VITE_DEV_API_TARGET || process.env.VITE_API_URL || "")
    .trim()
    .replace(/\/+$/, "");

  if (/^https?:\/\//i.test(configured)) {
    return configured;
  }

  return defaultApiTarget;
}

const apiTarget = resolveDevApiTarget();
const apiProxy = {
  "/api": {
    target: apiTarget,
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api(?=\/|$)/, "") || "/",
  },
  "/socket.io": {
    target: apiTarget,
    changeOrigin: true,
    ws: true,
  },
};

export default defineConfig(async () => {
  const [
    { default: tailwindcss },
    { tanstackStart },
    { default: react },
    { default: tsconfigPaths },
  ] = await Promise.all([
    import("@tailwindcss/vite"),
    import("@tanstack/react-start/plugin/vite"),
    import("@vitejs/plugin-react"),
    import("vite-tsconfig-paths"),
  ]);

  const plugins: PluginOption[] = [tailwindcss(), tsconfigPaths()];

  plugins.push(
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
    }),
    react(),
  );

  return {
    base: "/",
    plugins,
    build: {
      chunkSizeWarningLimit: 1300,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) {
              return undefined;
            }

            if (id.includes("recharts")) {
              return "vendor-charts";
            }

            if (id.includes("jspdf") || id.includes("html2canvas") || id.includes("dompurify")) {
              return "vendor-documents";
            }

            return undefined;
          },
        },
      },
    },
    server: {
      host: true,
      allowedHosts,
      proxy: apiProxy,
    },
    preview: {
      host: true,
      allowedHosts,
      strictPort: true,
      proxy: apiProxy,
    },
  };
});
