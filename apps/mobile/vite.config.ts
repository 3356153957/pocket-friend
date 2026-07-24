import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const photoToken = process.env.PF_PHOTO_TOKEN ?? process.env.VITE_PF_PHOTO_TOKEN;

export default defineConfig({
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
});
