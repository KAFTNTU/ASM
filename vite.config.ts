import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: { emptyOutDir: true },
  server: { port: 5173, strictPort: true, host: true },
});
