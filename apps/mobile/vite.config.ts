import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type ServerOptions } from "vite";

export default defineConfig(({ mode }) => {
  const mobileRoot = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(mobileRoot, "../..");
  const publicDemo = mode === "public-demo";

  return {
    envPrefix: ["VITE_", "EXPO_PUBLIC_"],
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: publicDemo
        ? [
          {
            find: "./app/productApi.ts",
            replacement: path.resolve(mobileRoot, "src/public-demo/productApi.ts"),
          },
          {
            find: "../app/productApi.ts",
            replacement: path.resolve(mobileRoot, "src/public-demo/productApi.ts"),
          },
          {
            find: "./app/photoPipeline.ts",
            replacement: path.resolve(mobileRoot, "src/public-demo/photoPipeline.ts"),
          },
          {
            find: "../app/photoPipeline.ts",
            replacement: path.resolve(mobileRoot, "src/public-demo/photoPipeline.ts"),
          },
        ]
        : [],
    },
    ...(publicDemo ? {} : { server: createDevServerConfig(mode, repoRoot, mobileRoot) }),
    build: {
      emptyOutDir: true,
      outDir: "../../dist/web",
    },
  };
});

function createDevServerConfig(mode: string, repoRoot: string, mobileRoot: string): ServerOptions {
  const env = {
    ...loadEnv(mode, repoRoot, ["VITE_", "EXPO_PUBLIC_", "PF_"]),
    ...loadEnv(mode, mobileRoot, ["VITE_", "EXPO_PUBLIC_", "PF_"]),
  };
  const photoToken = env.PF_PHOTO_TOKEN ?? process.env.PF_PHOTO_TOKEN;
  const productToken = env.PF_PRODUCT_API_TOKEN ?? process.env.PF_PRODUCT_API_TOKEN;
  const gatewayUrl = safeProxyUrl(
    env.EXPO_PUBLIC_GATEWAY_URL ?? env.VITE_GATEWAY_URL ?? "http://127.0.0.1:4310",
    "Gateway proxy target",
  );
  const photoApiUrl = safeProxyUrl(
    env.PF_PHOTO_API_URL ?? process.env.PF_PHOTO_API_URL ?? "http://127.0.0.1:4311",
    "PF_PHOTO_API_URL",
  );

  return {
      proxy: {
        "/avatar-api": {
          target: gatewayUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/avatar-api/, "/api/avatar"),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (productToken) {
                proxyReq.setHeader("Authorization", `Bearer ${productToken}`);
              }
            });
          },
        },
        "/photo-api": {
          target: photoApiUrl,
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
        "/product-api": {
          target: gatewayUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/product-api/, "/api/product"),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (productToken) {
                proxyReq.setHeader("Authorization", `Bearer ${productToken}`);
              }
            });
          },
        },
      },
  };
}

function safeProxyUrl(value: string, name: string): string {
  const url = new URL(value);
  const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new Error(`${name} must use HTTPS unless it targets loopback.`);
  }
  return url.toString();
}
