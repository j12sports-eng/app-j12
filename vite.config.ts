// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

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

export default defineConfig({
  vite: {
    base: "/",

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
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
        "/auth": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: true,
      allowedHosts,
    },
  },
});
