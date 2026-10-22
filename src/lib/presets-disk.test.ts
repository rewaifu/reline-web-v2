import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NodeType } from "~/types/enums";
import type { StackNode } from "~/types/node";

class MemoryStorage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, String(v));
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

/** The runner's folder, in memory, behind the same four methods the real one
 * answers. Each method can be made to fail. */
const runner = vi.hoisted(() => ({
  enabled: true,
  down: false,
  files: new Map<string, string>(),
  calls: [] as string[],
}));

vi.mock("~/lib/ws", () => {
  class WsRequestError extends Error {
    constructor(
      readonly kind: string,
      readonly method: string,
    ) {
      super(`${method}: ${kind}`);
    }
  }
  return {
    WsRequestError,
    wsHub: {
      call: async (name: string, data: Record<string, unknown>) => {
        runner.calls.push(
          name === "config_list" ? name : `${name} ${String(data.name)}`,
        );
        if (runner.down) throw new WsRequestError("closed", name);
        const file = String(data.name);
        switch (name) {
          case "config_list":
            return {
              entries: [...runner.files.keys()].sort(),
              enabled: runner.enabled,
            };
          case "config_read":
            if (!runner.files.has(file))
              throw new WsRequestError("remote", name);
            return { name: file, content: runner.files.get(file) };
          case "config_write":
            runner.files.set(file, String(data.content));
            return { name: file };
          case "config_delete":
            if (!runner.files.delete(file))
              throw new WsRequestError("remote", name);
            return {};
          default:
            throw new Error(`unexpected ${name}`);
        }
      },
    },
  };
});

const node = (type: string = NodeType.LEVEL): StackNode =>
  ({ uid: "u1", type, options: {} }) as StackNode;

const fileOf = (id: string, name = id, nodes: unknown[] = [node()]) =>
  JSON.stringify({ id, name, description: "", nodes });

const fresh = async () => {
  vi.resetModules();
  return import("~/lib/presets");
};

const names = (presets: Array<{ id: string }>) => presets.map((p) => p.id);

beforeEach(() => {
  runner.enabled = true;
  runner.down = false;
  runner.files = new Map();
  runner.calls = [];
  vi.stubGlobal("localStorage", new MemoryStorage());
});
afterEach(() => vi.unstubAllGlobals());

describe("presets on the runner's disk", () => {
  it("does nothing, and says so, when the runner has no folder", async () => {
    runner.enabled = false;
    const p = await fresh();
    p.saveUserPreset("Local", [node()]);
    await p.syncPresets();
    expect(p.presetsDisk()).toBe("off");
    expect(runner.calls).toEqual(["config_list"]);
    expect(p.allPresets().some((preset) => preset.name === "Local")).toBe(true);
  });

  it("a runner that cannot be reached is a failure and loses nothing", async () => {
    const p = await fresh();
    p.saveUserPreset("Local", [node()]);
    runner.down = true;
    await p.syncPresets();
    expect(p.presetsDisk()).toBe("failed");
    expect(p.allPresets().some((preset) => preset.name === "Local")).toBe(true);
  });

  it("brings the two sides together: disk-only comes here, browser-only goes there", async () => {
    runner.files.set("user-2.json", fileOf("user-2", "From disk"));
    const p = await fresh();
    const mine = p.saveUserPreset("From browser", [node()]);
    await p.syncPresets();

    expect(p.presetsDisk()).toBe("synced");
    const all = p.allPresets();
    expect(all.map((preset) => preset.name)).toEqual(
      expect.arrayContaining(["From disk", "From browser"]),
    );
    expect([...runner.files.keys()].sort()).toEqual(
      [`${mine.id}.json`, "user-2.json"].sort(),
    );
    expect(
      JSON.parse(runner.files.get(`${mine.id}.json`) ?? "{}"),
    ).toMatchObject({
      id: mine.id,
      name: "From browser",
      description: "panel.presets.description.user",
    });
  });

  it("the disk's copy wins for the same id", async () => {
    const p = await fresh();
    const mine = p.saveUserPreset("Old name", [node()]);
    runner.files.set(`${mine.id}.json`, fileOf(mine.id, "New name"));
    await p.syncPresets();
    expect(
      p
        .allPresets()
        .filter((preset) => preset.id === mine.id)
        .map((x) => x.name),
    ).toEqual(["New name"]);
  });

  it("leaves a file it cannot read alone — never overwrites it", async () => {
    runner.files.set("user-9.json", "{ not json");
    runner.files.set("user-8.json", fileOf("user-7", "Renamed by hand"));
    const p = await fresh();
    await p.syncPresets();
    expect(p.presetsDisk()).toBe("synced");
    expect(runner.files.get("user-9.json")).toBe("{ not json");
    expect(runner.files.get("user-8.json")).toBe(
      fileOf("user-7", "Renamed by hand"),
    );
    expect(
      p.allPresets().filter((preset) => preset.id.startsWith("user-")),
    ).toEqual([]);
  });

  it("takes only user presets from the disk", async () => {
    runner.files.set("default.json", fileOf("default", "Hijack"));
    const p = await fresh();
    await p.syncPresets();
    expect(p.allPresets().map((preset) => preset.name)).not.toContain("Hijack");
  });

  it("keeps nodes of a file honest: junk nodes are dropped, not rendered", async () => {
    runner.files.set(
      "user-3.json",
      fileOf("user-3", "Junk", [null, 7, node()]),
    );
    const p = await fresh();
    await p.syncPresets();
    const preset = p.allPresets().find((x) => x.id === "user-3");
    expect(preset?.nodes).toHaveLength(1);
  });

  it("is idempotent: a second sync writes nothing", async () => {
    const p = await fresh();
    p.saveUserPreset("Once", [node()]);
    await p.syncPresets();
    runner.calls = [];
    await p.syncPresets();
    expect(runner.calls.filter((c) => c.startsWith("config_write"))).toEqual(
      [],
    );
  });
});

describe("saving and deleting after a sync", () => {
  it("a save goes to the disk as it happens", async () => {
    const p = await fresh();
    await p.syncPresets();
    const saved = p.saveUserPreset("Live", [node()]);
    await vi.waitFor(() =>
      expect(runner.files.has(`${saved.id}.json`)).toBe(true),
    );
  });

  it("before any sync a save stays in the browser — no runner is known", async () => {
    const p = await fresh();
    p.saveUserPreset("Quiet", [node()]);
    expect(runner.calls).toEqual([]);
  });

  it("a delete removes the file", async () => {
    const p = await fresh();
    await p.syncPresets();
    const saved = p.saveUserPreset("Gone soon", [node()]);
    await vi.waitFor(() => expect(runner.files.size).toBe(1));
    p.deletePreset(saved.id);
    await vi.waitFor(() => expect(runner.files.size).toBe(0));
    expect(names(p.allPresets())).not.toContain(saved.id);
  });

  it("a delete that could not reach the runner is not undone by the next sync", async () => {
    const p = await fresh();
    const saved = p.saveUserPreset("Doomed", [node()]);
    await p.syncPresets();
    expect(runner.files.size).toBe(1);

    runner.down = true;
    p.deletePreset(saved.id);
    await vi.waitFor(() => expect(p.presetsDisk()).toBe("failed"));
    expect(runner.files.size).toBe(1);

    runner.down = false;
    await p.syncPresets();
    // the file is gone from the disk, and did not come back as a "new" preset
    expect(runner.files.size).toBe(0);
    expect(names(p.allPresets())).not.toContain(saved.id);
  });

  it("deleting a preset that never reached the disk is not a failure", async () => {
    const p = await fresh();
    await p.syncPresets();
    runner.files.clear();
    const saved = p.saveUserPreset("Never written", [node()]);
    runner.files.clear();
    p.deletePreset(saved.id);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(p.presetsDisk()).toBe("synced");
  });

  it("hiding a stock preset is local and never touches the disk", async () => {
    const p = await fresh();
    await p.syncPresets();
    runner.calls = [];
    p.deletePreset("default");
    expect(runner.calls).toEqual([]);
  });
});
