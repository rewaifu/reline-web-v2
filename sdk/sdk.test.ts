import { describe, expect, it } from "vitest";
import * as internalReactivity from "reze-js/internal/reactivity";
import * as internalRuntime from "reze-js/internal/runtime";
import * as reze from "reze-js";
import hostExports from "./host-exports.json";

/** The SDK's build helper re-exports the host's Reze modules by name. If an
 * upgrade adds or removes a name, a plugin built against the old list would
 * import something that is not there — regenerate the list (`pnpm sdk:exports`)
 * when this fails. */
describe("sdk host exports", () => {
  it("lists every name the host's Reze modules export", () => {
    const names = (ns: object) =>
      Object.keys(ns)
        .filter((n) => n !== "default")
        .sort();
    expect(hostExports["reze-js"]).toEqual(names(reze));
    expect(hostExports["reze-js/internal/reactivity"]).toEqual(
      names(internalReactivity),
    );
    expect(hostExports["reze-js/internal/runtime"]).toEqual(
      names(internalRuntime),
    );
  });
});
