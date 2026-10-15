import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, mount } from "@rezejs/testing-library";
import { store } from "reze-js";
import { NodesContext, NodesDispatchContext } from "~/context/contexts";
import { raw, setLocale } from "~/lib/i18n";
import { createDefaultNodes, nodeRegistry } from "~/lib/nodes";
import type { StackNode } from "~/types/node";
import { INSTRUCTION_LOADERS, InstructionsTab } from "./instructions-tab";

afterEach(() => {
  cleanup();
  setLocale("ru");
});

const mountFor = (nodes: StackNode[], uid: string) =>
  mount(() => (
    <NodesContext value={store(nodes)}>
      <NodesDispatchContext value={() => {}}>
        <InstructionsTab selectedUid={() => uid} />
      </NodesDispatchContext>
    </NodesContext>
  ));

describe("InstructionsTab", () => {
  it("shows the bundled guide once its chunk has loaded, in the language", async () => {
    const nodes = createDefaultNodes();
    const upscale = nodes.find((n) => n.type === "upscale")!;
    setLocale("en");
    const view = mountFor(nodes, upscale.uid);
    await vi.waitFor(() =>
      expect(view.el.querySelector("h1, h2, h3, p")?.textContent).toBeTruthy(),
    );
    await vi.waitFor(() =>
      expect(view.el.textContent).toContain("What it does"),
    );
    setLocale("ru");
    await vi.waitFor(() =>
      expect(view.el.textContent).not.toContain("What it does"),
    );
  });

  it("renders a plugin's own Markdown guide once the parser has loaded", async () => {
    const dispose = nodeRegistry.define({
      type: "test.guided",
      label: raw("Guided"),
      defaults: () => ({}),
      doc: {
        ru: "# Заголовок\n\nтекст **жирный**",
        en: "# Title\n\nbody **bold**",
      },
    });
    try {
      const nodes = createDefaultNodes();
      const added = { ...nodes[0], uid: "guided-uid", type: "test.guided" };
      const view = mountFor([...nodes, added], "guided-uid");
      await vi.waitFor(() =>
        expect(view.el.querySelector("strong")?.textContent).toBe("жирный"),
      );
      expect(view.el.querySelector("h1")?.textContent).toBe("Заголовок");
    } finally {
      dispose();
    }
  });
});

/** The guides are found by a glob relative to the file that holds it — moving
 * the file silently empties the map and every guide disappears. */
describe("node guides", () => {
  it("exist in both languages for every built-in node type", () => {
    const missing = nodeRegistry
      .list()
      .flatMap((def) => ["ru", "en"].map((l) => `${l}/${def.type}`))
      .filter((key) => !INSTRUCTION_LOADERS[key]);
    expect(missing).toEqual([]);
  });
});
