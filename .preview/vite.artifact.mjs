// Build de arquivo único para publicar como página hospedada (Artifact):
// JS e CSS embutidos, imagens da marca como data URI.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";
const root = path.resolve(import.meta.dirname, "..");
const dataUri = file => `data:image/png;base64,${fs.readFileSync(path.join(root, "public", file)).toString("base64")}`;
const brand = {
  name: "inline-brand",
  transform(code, id) {
    if (!id.endsWith(".tsx")) return null;
    if (!code.includes("/brand/")) return null;
    return code.replace(/"\/brand\/([a-z0-9-]+\.png)"/g, (_, f) => JSON.stringify(dataUri(`brand/${f}`)));
  },
};
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react(), brand],
  resolve: { alias: { "@": root } },
  css: { postcss: path.join(root, "postcss.config.mjs") },
  publicDir: false,
  build: {
    outDir: path.join(import.meta.dirname, "dist-artifact"),
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    modulePreload: false,
    rolldownOptions: { output: { codeSplitting: false } },
  },
});
