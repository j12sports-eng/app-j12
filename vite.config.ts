import { defineConfig, type ConfigEnv, type PluginOption, type UserConfig } from "vite";

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
  "/__api": {
    target: apiTarget,
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/__api(?=\/|$)/, "") || "/",
  },
  "/socket.io": {
    target: apiTarget,
    changeOrigin: true,
    ws: true,
  },
};

export default defineConfig(async ({ command }: ConfigEnv): Promise<UserConfig> => {
  if (command === "build") {
    process.env.NODE_ENV = "production";
    process.env.BABEL_ENV = "production";
  }

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
    react({
      jsxRuntime: "automatic",
    }),
  );

  return {
    base: "/",
    plugins,
    esbuild: {
      jsx: "automatic",
    },
    build: {
      chunkSizeWarningLimit: 1300,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
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
