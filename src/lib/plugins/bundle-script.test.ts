import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error — a plain .mjs build script, no declarations
import { bundlePlugins } from "../../../scripts/bundle-plugins.mjs";

/** The bundling script that embeds plugins into a built site. */

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "bundle-"));
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

const plugin = (name: string, id: string, code = "export default {}") => {
  const dir = join(tmp, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.js"), code);
  writeFileSync(
    join(dir, "plugin.json"),
    JSON.stringify({
      id,
      name,
      version: "1.0.0",
      api: 1,
      entry: "index.js",
      caps: [],
      integrity: `sha384-${createHash("sha384").update(code).digest("base64")}`,
    }),
  );
  return dir;
};

const site = () => {
  const dir = join(tmp, "site");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), "<html></html>");
  return dir;
};

describe("bundle-plugins", () => {
  it("copies each plugin and lists it relative to the list file", () => {
    const out = site();
    const ids = bundlePlugins(out, [
      plugin("a", "acme.aaa"),
      plugin("b", "acme.bbb"),
    ]);
    expect(ids).toEqual(["acme.aaa", "acme.bbb"]);
    expect(
      JSON.parse(readFileSync(join(out, "plugins", "bundled.json"), "utf8")),
    ).toEqual({
      schema: 1,
      plugins: ["bundled/acme.aaa/plugin.json", "bundled/acme.bbb/plugin.json"],
    });
    expect(
      existsSync(join(out, "plugins", "bundled", "acme.bbb", "index.js")),
    ).toBe(true);
  });

  it("rewrites the list on every run", () => {
    const out = site();
    bundlePlugins(out, [plugin("a", "acme.aaa")]);
    bundlePlugins(out, [plugin("b", "acme.bbb")]);
    expect(existsSync(join(out, "plugins", "bundled", "acme.aaa"))).toBe(false);
  });

  it("refuses a plugin whose pin does not match its code", () => {
    const dir = plugin("a", "acme.aaa");
    writeFileSync(join(dir, "index.js"), "export default { changed: 1 }");
    expect(() => bundlePlugins(site(), [dir])).toThrow(/integrity/);
  });

  it("refuses a duplicate id, a missing manifest and a site that is not built", () => {
    expect(() =>
      bundlePlugins(site(), [plugin("a", "acme.aaa"), plugin("b", "acme.aaa")]),
    ).toThrow(/twice/);
    expect(() => bundlePlugins(site(), [join(tmp, "nope")])).toThrow(
      /no plugin.json/,
    );
    expect(() => bundlePlugins(tmp, [])).toThrow(/not a built site/);
  });
});
