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
    ?? process.env.PF_PHOTO_TOKEN;
  const productToken =
    env.PF_PRODUCT_API_TOKEN
    ?? process.env.PF_PRODUCT_API_TOKEN;
  const gatewayUrl = safeProxyUrl(
    env.EXPO_PUBLIC_GATEWAY_URL ?? env.VITE_GATEWAY_URL ?? "http://127.0.0.1:4310",
    "Gateway proxy target",
  );
  const photoApiUrl = safeProxyUrl(
    env.PF_PHOTO_API_URL ?? process.env.PF_PHOTO_API_URL ?? "http://127.0.0.1:4311",
    "PF_PHOTO_API_URL",
    { allowHttpRemote: true },
  );

  return {
    envPrefix: ["VITE_", "EXPO_PUBLIC_"],
    plugins: [react(), tailwindcss()],
    server: {
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
    },
    build: {
      emptyOutDir: true,
      outDir: "../../dist/web",
    },
  };
});

function safeProxyUrl(value: string, name: string, options: { allowHttpRemote?: boolean } = {}): string {
  const url = new URL(value);
  const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  const allowedHttp = loopback || options.allowHttpRemote;
  if (url.protocol !== "https:" && !(url.protocol === "http:" && allowedHttp)) {
    throw new Error(`${name} must use HTTPS unless HTTP is explicitly allowed for this proxy.`);
  }
  return url.toString();
}
