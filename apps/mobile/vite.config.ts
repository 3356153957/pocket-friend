import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  envPrefix: ["VITE_", "EXPO_PUBLIC_"],
  plugins: [react(), tailwindcss()],
  build: {
    emptyOutDir: true,
    outDir: "../../dist/web",
  },
});
