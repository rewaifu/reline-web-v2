import { cleanup, mount, tick } from "@rezejs/testing-library";
import type { Component } from "~/types/component";
import { onCleanup } from "reze-js";
import { afterEach, describe, expect, it } from "vitest";
import { overridable } from "~/components/slot/overridable";
import type { NodeFormProps } from "~/components/nodes/node-options-form";
import { Slot } from "~/components/slot/slot";
import { createNode } from "~/lib/nodes";
import { pipeline } from "~/lib/pipeline";
import type { StackNode } from "~/types/node";
import { uiRegistry } from "~/lib/ui/registry";

/** What a plugin puts on screen goes through three doors: slots, replacements
 * of host components, and tabs. Each must (a) show up and go away with its
 * disposer, and (b) fail alone — a plugin component that throws while rendering
 * may cost its own space, never its neighbours'. */
const level = (uid: string): StackNode => ({ ...createNode("level")!, uid });

const undo: (() => void)[] = [];
afterEach(() => {
  // no globals in this config: the library does not unmount between tests alone
  cleanup();
  while (undo.length > 0) undo.pop()?.();
});

const Boom: Component = () => {
  throw new Error("render failed");
};

describe("slots", () => {
  it("renders contributions in order with the host's context", () => {
    undo.push(
      uiRegistry.slot("node.card.footer", (p) => <i>late {p.node.uid}</i>, {
        order: 200,
      }),
      uiRegistry.slot("node.card.footer", (p) => <i>early {p.node.uid}</i>, {
        order: 10,
      }),
    );
    const view = mount(() => (
      <Slot name="node.card.footer" context={{ node: level("n1") }} />
    ));
    expect(
      [...view.el.querySelectorAll("i")].map((e) => e.textContent),
    ).toEqual(["early n1", "late n1"]);
  });

  it("follows the registry: a contribution added or removed later shows or goes", () => {
    const view = mount(() => <Slot name="topbar" />);
    expect(view.el.textContent).toBe("");
    const dispose = uiRegistry.slot("topbar", () => <b>plugin</b>);
    tick();
    expect(view.el.textContent).toBe("plugin");
    dispose();
    tick();
    expect(view.el.textContent).toBe("");
  });

  it("a contribution that throws is contained and reported; the others render", () => {
    undo.push(
      uiRegistry.slot("stack.footer", Boom, { owner: "acme.bad" }),
      uiRegistry.slot("stack.footer", () => <b>fine</b>, { owner: "acme.ok" }),
    );
    const view = mount(() => <Slot name="stack.footer" />);
    tick();
    expect(view.el.textContent).toBe("fine");
    expect(pipeline.failures().at(-1)).toMatchObject({
      stage: "ui",
      id: "acme.bad:stack.footer",
      message: "render failed",
    });
  });

  it("runs a contribution's cleanup when it goes", () => {
    let cleaned = 0;
    const dispose = uiRegistry.slot("topbar", () => {
      onCleanup(() => (cleaned += 1));
      return <b>x</b>;
    });
    mount(() => <Slot name="topbar" />);
    tick();
    dispose();
    tick();
    expect(cleaned).toBe(1);
  });
});

describe("overridable components", () => {
  const Base: Component<NodeFormProps> = (p) => <p>base {p.node.uid}</p>;
  const Host = overridable("NodeBody", Base);

  it("is the original with no override", () => {
    const view = mount(() => <Host node={level("a")} />);
    expect(view.el.textContent).toBe("base a");
  });

  it("an override replaces it, and disposing restores it", () => {
    const view = mount(() => <Host node={level("a")} />);
    const dispose = uiRegistry.override("NodeBody", () => (p) => (
      <p>mine {p.node.uid}</p>
    ));
    tick();
    expect(view.el.textContent).toBe("mine a");
    dispose();
    tick();
    expect(view.el.textContent).toBe("base a");
  });

  it("overrides stack: each sees the one before it", () => {
    undo.push(
      uiRegistry.override("NodeBody", (Prev) => (p) => (
        <div>
          [<Prev {...p} />]
        </div>
      )),
      uiRegistry.override("NodeBody", (Prev) => (p) => (
        <div>({<Prev {...p} />})</div>
      )),
    );
    const view = mount(() => <Host node={level("a")} />);
    expect(view.el.textContent).toBe("([base a])");
  });

  it("an override that throws falls back to the component under it", () => {
    undo.push(uiRegistry.override("NodeBody", () => Boom, "acme.bad"));
    const view = mount(() => <Host node={level("a")} />);
    tick();
    expect(view.el.textContent).toBe("base a");
    expect(pipeline.failures().at(-1)).toMatchObject({
      stage: "ui",
      id: "acme.bad:NodeBody",
    });
  });

  it("does not remount while the override list is unchanged", () => {
    let mounts = 0;
    undo.push(
      uiRegistry.override("NodeBody", () => () => {
        mounts += 1;
        return <b>x</b>;
      }),
    );
    mount(() => <Host node={level("a")} />);
    tick();
    // an unrelated registry change re-reads the list; the composed component
    // keeps its identity, so nothing remounts
    undo.push(uiRegistry.slot("topbar", () => <i />));
    tick();
    expect(mounts).toBe(1);
  });
});

describe("panel tabs and styles", () => {
  it("lists tabs in order and drops one with its disposer", () => {
    const Tab: Component = () => <p>tab</p>;
    undo.push(
      uiRegistry.panelTab({
        id: "acme.b",
        label: "panel.tabs.code",
        Component: Tab,
        order: 300,
      }),
      uiRegistry.panelTab({
        id: "acme.a",
        label: "panel.tabs.code",
        Component: Tab,
        order: 250,
      }),
    );
    expect(
      uiRegistry
        .panelTabs()
        .map((t) => t.id)
        .filter((id) => id.startsWith("acme.")),
    ).toEqual(["acme.a", "acme.b"]);
    undo.pop()?.();
    expect(uiRegistry.panelTabs().some((t) => t.id === "acme.a")).toBe(false);
  });

  it("injects a style sheet and removes exactly it", () => {
    const before = document.head.querySelectorAll("style").length;
    const dispose = uiRegistry.styles(".acme-x { color: red }", "acme");
    const adopted =
      "adoptedStyleSheets" in document &&
      typeof CSSStyleSheet.prototype.replaceSync === "function";
    if (!adopted)
      expect(document.head.querySelectorAll("style").length).toBe(before + 1);
    dispose();
    expect(document.head.querySelectorAll("style").length).toBe(before);
  });
});
