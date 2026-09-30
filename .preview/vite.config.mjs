import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  resolve: { alias: { "@": root } },
  css: { postcss: path.join(root, "postcss.config.mjs") },
  publicDir: path.join(root, "public"),
  server: { port: 5188, fs: { allow: [root] } },
  build: { outDir: path.join(import.meta.dirname, "dist"), emptyOutDir: true },
});
