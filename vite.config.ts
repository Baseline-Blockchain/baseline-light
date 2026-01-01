import { defineConfig } from "vite";
import path from "path";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig(({ command }) => {
  const isServe = command === "serve";
  return {
    plugins: [
      react(),
      wasm(),
      topLevelAwait(),
      nodePolyfills({
        protocolImports: true,
      }),
    ],
    resolve: isServe
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
