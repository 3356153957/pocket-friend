import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const mobileRoot = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(mobileRoot, "../..");
  const env = {
    ...loadEnv(mode, repoRoot, ["VITE_", "EXPO_PUBLIC_", "PF_"]),
    ...loadEnv(mode, mobileRoot, ["VITE_", "EXPO_PUBLIC_", "PF_"]),
  };
  const photoToken =
    env.PF_PHOTO_TOKEN
    ?? env.VITE_PF_PHOTO_TOKEN
    ?? process.env.PF_PHOTO_TOKEN
    ?? process.env.VITE_PF_PHOTO_TOKEN;

  return {
    envPrefix: ["VITE_", "EXPO_PUBLIC_"],
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        "/photo-api": {
          target: "http://117.72.82.29:4311",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/photo-api/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (photoToken) {
                proxyReq.setHeader("Authorization", `Bearer ${photoToken}`);
              }
            });
          },
        },
      },
    },
    build: {
      emptyOutDir: true,
      outDir: "../../dist/web",
    },
  };
});
