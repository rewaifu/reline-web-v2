// Embeds plugins into a built site, so a deployment (a Tauri shell, a company
// build) ships them preinstalled. Run it after `pnpm build`:
//
//   node scripts/bundle-plugins.mjs <site-dir> <plugin-dir>...
//   node scripts/bundle-plugins.mjs dist/client ../my-plugin/dist examples/x
//
// A <plugin-dir> holds a pinned `plugin.json` (the output of `vite build` with
// relinePlugin(), or of `pnpm plugin:pin`) and its entry. Each one is copied to
// <site-dir>/plugins/bundled/<id>/ and listed in <site-dir>/plugins/bundled.json,
// which the host reads at start (src/lib/plugins/bundled.ts). The list is
// rewritten on every run: it names exactly the directories given.
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/;

const readManifest = (dir) => {
  const file = join(dir, "plugin.json");
  if (!existsSync(file)) throw new Error(`${dir}: no plugin.json`);
  const manifest = JSON.parse(readFileSync(file, "utf8"));
  if (typeof manifest.id !== "string" || !ID.test(manifest.id))
    throw new Error(`${file}: bad id ${JSON.stringify(manifest.id)}`);
  if (typeof manifest.entry !== "string" || manifest.entry === "")
    throw new Error(`${file}: no entry`);
  const entry = resolve(dir, manifest.entry);
  const inside = relative(resolve(dir), entry);
  if (inside.startsWith("..") || isAbsolute(inside))
    throw new Error(`${file}: entry leaves the plugin directory`);
  if (!existsSync(entry)) throw new Error(`${file}: ${manifest.entry} missing`);
  const pin = `sha384-${createHash("sha384").update(readFileSync(entry)).digest("base64")}`;
  if (manifest.integrity !== pin)
    throw new Error(
      `${file}: integrity does not match ${manifest.entry} (rebuild the plugin)`,
    );
  return { manifest, entry: inside };
};

/** Copies the plugins and writes the list. Returns the bundled ids. */
export const bundlePlugins = (site, dirs) => {
  if (!existsSync(join(site, "index.html")))
    throw new Error(`${site}: not a built site (no index.html)`);
  const root = join(site, "plugins");
  const target = join(root, "bundled");
  const ids = new Set();
  const found = dirs.map((dir) => {
    const plugin = readManifest(dir);
    if (ids.has(plugin.manifest.id))
      throw new Error(`${plugin.manifest.id} is given twice`);
    ids.add(plugin.manifest.id);
    return { dir, ...plugin };
  });
  rmSync(target, { recursive: true, force: true });
  for (const { dir, manifest, entry } of found) {
    const out = join(target, manifest.id);
    mkdirSync(dirname(join(out, entry)), { recursive: true });
    copyFileSync(join(dir, "plugin.json"), join(out, "plugin.json"));
    copyFileSync(join(dir, entry), join(out, entry));
  }
  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(root, "bundled.json"),
    `${JSON.stringify(
      {
        schema: 1,
        plugins: found.map(
          ({ manifest }) => `bundled/${manifest.id}/plugin.json`,
        ),
      },
      null,
      2,
    )}\n`,
  );
  return found.map(({ manifest }) => manifest.id);
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [site, ...dirs] = process.argv.slice(2);
  if (site === undefined)
    throw new Error("usage: bundle-plugins.mjs <site-dir> <plugin-dir>...");
  const ids = bundlePlugins(site, dirs);
  console.log(`${site}/plugins/bundled.json  ${ids.length} plugins`);
  for (const id of ids) console.log(`  ${id}`);
}
