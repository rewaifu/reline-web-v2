import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { PLUGIN_API_VERSION } from "../src/lib/plugins/manifest";
import hostExports from "./host-exports.json" with { type: "json" };

/**
 * Vite helper for building a Reline plugin.
 *
 *   plugins: [relinePlugin({ manifest }), reze()]
 *
 * It does two things the plugin cannot do for itself:
 *
 * 1. `reze-js` and its internal entries are not bundled. Imports of them become
 *    reads from `globalThis.__RELINE__`, the host's own copies — two copies of
 *    the reactive graph do not see each other, so a component built on its own
 *    Reze would never update the host's page.
 * 2. After the bundle is written it hashes the entry and writes `plugin.json`
 *    next to it with the entry name and the SHA-384 pin, which is what the host
 *    checks before it runs a byte of the code.
 */
export interface PluginManifestSource {
  id: string;
  name: string;
  version: string;
  description?: string;
  /** The description in the reader's language; `description` is the fallback. */
  descriptions?: { ru?: string; en?: string };
  caps: readonly string[];
  requires?: Record<string, string>;
}

export interface RelinePluginOptions {
  manifest: PluginManifestSource;
  /** Output file name of the entry chunk. Defaults to `<last id segment>.js`. */
  entryName?: string;
}

const HOST_MODULES = [
  "reze-js",
  "reze-js/internal/reactivity",
  "reze-js/internal/runtime",
] as const;

type HostModule = (typeof HOST_MODULES)[number];

const isHostModule = (source: string): source is HostModule =>
  HOST_MODULES.some((module) => module === source);

const shimFor = (specifier: HostModule): string =>
  [
    `const host = globalThis.__RELINE__?.[${JSON.stringify(specifier)}];`,
    `if (host === undefined) throw new Error("Reline host not found: this plugin must be loaded by Reline");`,
    // `export const x = host.x` per name: a plugin imports names, and an ES
    // module needs them declared statically
    ...hostExports[specifier].map(
      (name) => `export const ${name} = host.${name};`,
    ),
    "export default host;",
  ].join("\n");

export const relinePlugin = (options: RelinePluginOptions): Plugin[] => {
  const virtual = (specifier: string) => `\0reline-host:${specifier}`;
  const entryName =
    options.entryName ?? `${options.manifest.id.split(".").at(-1)}.js`;
  let outDir = "";
  return [
    {
      name: "reline-plugin:host-externals",
      enforce: "pre",
      resolveId(source) {
        return isHostModule(source) ? virtual(source) : null;
      },
      load(id) {
        for (const specifier of HOST_MODULES)
          if (id === virtual(specifier)) return shimFor(specifier);
        return null;
      },
    },
    {
      name: "reline-plugin:manifest",
      apply: "build",
      config(config) {
        // one ES module, named predictably: the manifest points at it
        return {
          build: {
            ...config.build,
            lib: {
              entry: config.build?.lib
                ? (config.build.lib as { entry: string }).entry
                : "src/index.tsx",
              formats: ["es"],
              fileName: () => entryName,
            },
          },
        };
      },
      configResolved(resolved) {
        outDir = resolved.build.outDir;
      },
      writeBundle(_, bundle) {
        const entry = Object.values(bundle).find(
          (chunk) => chunk.type === "chunk" && chunk.isEntry,
        );
        if (entry === undefined)
          throw new Error("reline-plugin: no entry chunk");
        const code = readFileSync(join(outDir, entry.fileName));
        const integrity = `sha384-${createHash("sha384").update(code).digest("base64")}`;
        const { manifest } = options;
        writeFileSync(
          join(outDir, "plugin.json"),
          `${JSON.stringify(
            {
              id: manifest.id,
              name: manifest.name,
              version: manifest.version,
              api: PLUGIN_API_VERSION,
              description: manifest.description,
              descriptions: manifest.descriptions,
              entry: entry.fileName,
              integrity,
              caps: manifest.caps,
              requires: manifest.requires,
            },
            null,
            2,
          )}\n`,
        );
      },
    },
  ];
};
