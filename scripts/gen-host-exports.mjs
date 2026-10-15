// Writes sdk/host-exports.json: the names the host's Reze modules export, which
// the SDK's build helper needs to re-export `reze-js` and its internal entries
// from the host's own copy at runtime (a plugin must never bundle a second Reze).
//
//   node --conditions=browser scripts/gen-host-exports.mjs
//
// `--conditions=browser` picks the client builds — the ones the app ships.
import { writeFileSync } from "node:fs";

const names = async (specifier) =>
  Object.keys(await import(specifier))
    .filter((n) => n !== "default")
    .sort();

const out = {
  "reze-js": await names("reze-js"),
  "reze-js/internal/reactivity": await names("reze-js/internal/reactivity"),
  "reze-js/internal/runtime": await names("reze-js/internal/runtime"),
};
writeFileSync(
  new URL("../sdk/host-exports.json", import.meta.url),
  `${JSON.stringify(out, null, 2)}\n`,
);
console.log(
  Object.entries(out)
    .map(([specifier, list]) => `${specifier}: ${list.length} names`)
    .join(", "),
);
