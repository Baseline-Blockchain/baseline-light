import { defineConfig } from "vite";
import path from "path";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig(({ command }) => {
  const isServe = command === "serve";
  const isTauriDev = Boolean(process.env.TAURI_ENV_PLATFORM || process.env.TAURI_PLATFORM);
  const useBrowserShim = isServe && !isTauriDev;
  return {
    plugins: [
      react(),
      wasm(),
      topLevelAwait(),
      nodePolyfills({
        protocolImports: true,
      }),
    ],
    resolve: useBrowserShim
      ? {
          alias: {
            "@tauri-apps/plugin-http": path.resolve(__dirname, "src/lib/tauri-http-shim.ts"),
          },
        }
      : {},
    build: {
      target: "esnext",
    },
    optimizeDeps: {
      include: ["buffer", "process", "events", "stream"],
    },
  };
});
