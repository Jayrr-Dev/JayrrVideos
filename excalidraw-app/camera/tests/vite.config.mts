import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

// Run from the repo root with:
// npx vite --config excalidraw-app/camera/tests/vite.config.mts
export default defineConfig({
  root: fileURLToPath(new URL("../../", import.meta.url)),
  optimizeDeps: { entries: ["camera/tests/cutout-gpu.html"] },
  cacheDir: "node_modules/.vite-cutout-tests",
  server: { host: "127.0.0.1", port: 3001, strictPort: true, open: false },
});
