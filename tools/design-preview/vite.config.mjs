/** Servidor local da comparação visual, usando componentes reais e dados fictícios. */
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const root = fileURLToPath(new URL(".", import.meta.url));
const repository = fileURLToPath(new URL("../..", import.meta.url));
export default defineConfig({
  root,
  publicDir: `${repository}/public`,
  plugins: [react()],
  define: { "process.env.NEXT_PUBLIC_STRATO_TENANT_ID": JSON.stringify("strato-demo") },
  resolve: { alias: { "@": repository }, dedupe: ["react", "react-dom"] },
  server: { host: "127.0.0.1", port: 5174, strictPort: true, fs: { allow: [repository] } },
  build: { outDir: "/tmp/strato-design-preview-build", emptyOutDir: true },
});
