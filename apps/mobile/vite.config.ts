import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { Connect } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";

const DOUBAO_ORIGIN = "https://ark.cn-beijing.volces.com";

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
  const doubaoApiKey =
    env.DOUBAO_API_KEY
    ?? env.VITE_DOUBAO_API_KEY
    ?? process.env.DOUBAO_API_KEY
    ?? process.env.VITE_DOUBAO_API_KEY;

  return {
    envPrefix: ["VITE_", "EXPO_PUBLIC_"],
    plugins: [react(), tailwindcss(), seedreamImageProxyPlugin()],
    server: {
      proxy: {
        "/seedream-api": {
          target: DOUBAO_ORIGIN,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/seedream-api/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (doubaoApiKey) {
                proxyReq.setHeader("Authorization", `Bearer ${doubaoApiKey}`);
              }
            });
          },
        },
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

function seedreamImageProxyPlugin() {
  return {
    name: "seedream-image-proxy",
    configureServer(server: { middlewares: Connect.Server }) {
      server.middlewares.use("/seedream-image-proxy", async (request, response) => {
        const requestUrl = new URL(request.url ?? "", "http://localhost");
        const imageUrl = requestUrl.searchParams.get("url");

        if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
          response.statusCode = 400;
          response.end("Missing image url.");
          return;
        }

        try {
          const upstream = await fetch(imageUrl);
          if (!upstream.ok) {
            response.statusCode = upstream.status;
            response.end(`Image proxy failed: ${upstream.status}`);
            return;
          }

          const contentType = upstream.headers.get("content-type") ?? "image/png";
          response.setHeader("Content-Type", contentType);
          response.setHeader("Cache-Control", "no-store");
          response.end(Buffer.from(await upstream.arrayBuffer()));
        } catch (error) {
          response.statusCode = 502;
          response.end(error instanceof Error ? error.message : "Image proxy failed.");
        }
      });
    },
  };
}
