import reze from "@rezejs/vite-plugin";
import { defineConfig } from "vitest/config";

import { fileURLToPath } from "node:url";

export default defineConfig(({ command }) => ({
  // CDN serves the app from a nested path, so the built page must reference
  // its chunks relatively (./assets/…) — dev keeps an absolute root.
  base: command === "build" ? "./" : "/",
  resolve: {
    alias: [
      {
        find: "~",
        replacement: fileURLToPath(new URL("./src", import.meta.url)),
      },
      // plugins import their types and `definePlugin` from the SDK
      {
        find: "@reline/plugin-sdk",
        replacement: fileURLToPath(new URL("./sdk/index.ts", import.meta.url)),
      },
    ],
  },
  plugins: [reze({ diagnostics: { jsonl: "node_modules/.cache/reze-diagnostics.jsonl" } })],
  server: {
    port: 3000,
  },
  define:
    process.env.VITEST === undefined
      ? {}
      : { __REZE_HTML__: "false", __REZE_HYDRATE__: "false" },
  test: {
    environment: "jsdom",
    globals: false,
  },
  build: {
    // the deployments (CDN, Tauri, `plugin:bundle`) take the site from here
    outDir: "dist/client",
    target: "esnext",
    // Keep images as asset files instead of inlining them into the JS bundle.
    assetsInlineLimit: 0,
    manifest: false,
    rolldownOptions: {
      output: {
        // Vite 8 default minifier is oxc; the object form unlocks its compress
        // options. `codegen: true` keeps whitespace removal on (this is the
        // boolean form of the default `minify: 'oxc'`).
        minify: {
          compress: { dropConsole: true, dropDebugger: true },
          mangle: true,
          codegen: true,
        },
      },
    },
  },
}));
