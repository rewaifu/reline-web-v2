import reze from "@rezejs/vite-plugin";
import { readFile } from "node:fs/promises";
import { marked } from "marked";
import { defineConfig, type Plugin } from "vitest/config";

import { fileURLToPath } from "node:url";

/** `import html from "./guide.md?html"`: the Markdown compiled at build time, so
 * the parser is not shipped for files that never change at run time. */
const markdownHtml = (): Plugin => ({
  name: "reline:markdown-html",
  enforce: "pre",
  async load(id) {
    if (!id.endsWith(".md?html")) return null;
    const path = id.slice(0, -"?html".length);
    this.addWatchFile(path);
    const html = marked.parse(await readFile(path, "utf8"), { async: false });
    return `export default ${JSON.stringify(html)};`;
  },
});

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
  plugins: [
    markdownHtml(),
    reze({
      // the library ships no current manifest: analyse its source instead
      analyze: ["@rebase-ui/reze"],
      diagnostics: { jsonl: "node_modules/.cache/reze-diagnostics.jsonl" },
    }),
  ],
  optimizeDeps: {
    // Reze library sources hold compiler syntax: the Reze plugin compiles them,
    // pre-bundling would feed them to the bundler raw
    exclude: ["@rebase-ui/reze"],
    // the dependency scan parses JSX itself, before the Reze plugin runs
    rolldownOptions: {
      transform: { jsx: { runtime: "automatic", importSource: "reze-js" } },
    },
  },
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
