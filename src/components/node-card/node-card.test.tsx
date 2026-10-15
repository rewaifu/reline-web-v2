import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fire, mount } from "@rezejs/testing-library";
import { store } from "reze-js";
import {
  AnalysisContext,
  NodesContext,
  NodesDispatchContext,
} from "~/context/contexts";
import { analyze } from "~/lib/config";
import { createNodesDispatch } from "~/context/reducer";
import { NodesActionType } from "~/types/actions";
import { NodeStack } from "~/components/node-card/node-card";
import { createDefaultNodes, nodeLabel } from "~/lib/nodes";
import { NodeType } from "~/types/enums";
import { t } from "~/lib/i18n";
import type { FolderReaderNodeOptions } from "~/types/options";

/** Reported: typing at the start of a path field did nothing until the value
 * already held `/` or `./`. Behind that: an option change that recreates the
 * input drops the caret, the focus and (for a keystroke landing mid-word) the
 * text itself — the field only *looks* alive when typing at the end, where a
 * value restored from the store plus a caret at the end are indistinguishable
 * from the real thing. jsdom cannot type characters, so the invariant checked
 * here is the element identity: same input node, same focus, and the store,
 * not the DOM, owns the text. */

vi.mock("~/lib/ls-client", () => ({
  lsClient: {
    ls: () =>
      Promise.resolve({ entries: ["raws", "raws_extra"], dirs: ["raws"] }),
  },
}));

/** The four sites below query the path field by its label rather than its
 * placeholder: the placeholder is an example of a wire value and may be
 * reworded, while the label is the very string the field renders — the same
 * dictionary key, so the query follows a language switch too. */
const pathField = () => t("form.folder_reader.path");

/** Input associated with a `<label>` whose text matches (via `for`/`id`). */
const labelledInput = (root: HTMLElement, text: string) => {
  const label = Array.from(root.querySelectorAll("label")).find(
    (el) => el.textContent.trim() === text,
  );
  if (label === undefined) throw new Error(`no label "${text}"`);
  return document.getElementById(label.htmlFor) as HTMLInputElement;
};

const byLabel = (root: HTMLElement, text: string) =>
  Array.from(root.querySelectorAll<HTMLElement>(`[aria-label="${text}"]`));

/** Leaf element whose text is exactly `text`. */
const byText = (root: HTMLElement, text: string) => {
  const hit = Array.from(root.querySelectorAll<HTMLElement>("*")).find(
    (el) => el.children.length === 0 && el.textContent.trim() === text,
  );
  if (hit === undefined) throw new Error(`no text "${text}"`);
  return hit;
};

describe("path field under the node store", () => {
  let nodes = store(createDefaultNodes());

  beforeEach(() => {
    nodes = store(createDefaultNodes());
    // the folder reader is the first node; its form only renders expanded
    nodes[0].collapsed = false;
  });

  afterEach(cleanup);

  const readerPath = () => (nodes[0].options as FolderReaderNodeOptions).path;

  const mountStack = (
    selectedUid: () => string | null,
    isSelected: (uid: string) => boolean,
  ) => {
    const dispatch = createNodesDispatch(nodes);
    return mount(() => {
      const analysis = () => analyze([...nodes]);
      return (
        <NodesContext value={nodes}>
          <NodesDispatchContext value={dispatch}>
            <AnalysisContext value={analysis}>
              <NodeStack
                selectedUid={selectedUid}
                isSelected={isSelected}
                onSelect={() => {}}
                phone={false}
              />
            </AnalysisContext>
          </NodesDispatchContext>
        </NodesContext>
      );
    });
  };

  it("keeps the same input element while its options change", async () => {
    const view = mountStack(
      () => nodes[0].uid,
      (uid) => uid === nodes[0].uid,
    );
    const before = labelledInput(view.el, pathField());
    before.focus();
    expect(document.activeElement).toBe(before);

    before.value = "raws";
    fire(before, "input");
    await vi.waitFor(() => expect(readerPath()).toBe("raws"));

    const after = labelledInput(view.el, pathField());
    // a remounted input would be a different node, unfocused, with the caret
    // parked at the end — the shape the bug report describes
    expect(after).toBe(before);
    expect(document.activeElement).toBe(before);
    expect(before.value).toBe("raws");
  });

  it("accepts an insertion at the start of the value", async () => {
    const view = mountStack(
      () => nodes[0].uid,
      (uid) => uid === nodes[0].uid,
    );
    const input = labelledInput(view.el, pathField());
    input.value = "src";
    fire(input, "input");
    await vi.waitFor(() => expect(readerPath()).toBe("src"));

    // the state the caret sits in when the user types at the beginning
    input.focus();
    input.setSelectionRange(0, 0);
    input.value = "./src";
    fire(input, "input");
    await vi.waitFor(() => expect(readerPath()).toBe("./src"));

    expect(labelledInput(view.el, pathField())).toBe(input);
    expect(input.value).toBe("./src");
    expect(document.activeElement).toBe(input);
  });

  /** The title carried its own click handler (select) *and* stopped the event,
   * so the header's fold never ran for a click on the name or on the wide empty
   * stretch beside it (the title is `flex: 1`): the card took two clicks to
   * open. Double-click-to-rename was the other half of that history, and the
   * pencil button never needed a gesture beside it. */
  it("folds on the first click on the title, and leaves renaming to the pencil", async () => {
    const view = mountStack(
      () => null,
      () => false,
    );
    const upscale = () => nodes[1];

    // the upscale node starts collapsed: one click selects *and* folds
    fire(byText(view.el, nodeLabel(NodeType.UPSCALE)), "click");
    await vi.waitFor(() => expect(upscale().collapsed).toBe(false));
    expect(byLabel(view.el, t("chrome.nodeName"))).toHaveLength(0);

    // and one more click folds it back — the first click always acts
    fire(byText(view.el, nodeLabel(NodeType.UPSCALE)), "click");
    await vi.waitFor(() => expect(upscale().collapsed).toBe(true));

    // the grip is a drag surface: a tap on it selects, but must not fold —
    // otherwise dropping a dragged card would fold the card that was dropped
    const grips = byLabel(view.el, t("chrome.reorder"));
    fire(grips[1] as HTMLElement, "click");
    await vi.waitFor(() => expect(upscale().collapsed).toBe(true));

    // the pencil is the one way into renaming, and it still works
    const pencils = byLabel(view.el, t("chrome.rename"));
    fire(pencils[1] as HTMLElement, "click");
    await vi.waitFor(() =>
      expect(byLabel(view.el, t("chrome.nodeName"))).toHaveLength(1),
    );
  });

  it("marks a disabled node on its stack card", async () => {
    const dispatch = createNodesDispatch(nodes);
    const view = mountStack(
      () => null,
      () => false,
    );
    const uid = nodes[1].uid;
    const card = () =>
      view.el.querySelector(`[data-node-id="${uid}"]`) as HTMLElement | null;
    expect(card()?.className).not.toMatch(/disabled/);
    dispatch({
      type: NodesActionType.CHANGE,
      payload: { uid, enabled: false },
    });
    await vi.waitFor(() => expect(card()?.className).toMatch(/disabled/));
    dispatch({
      type: NodesActionType.CHANGE,
      payload: { uid, enabled: true },
    });
    await vi.waitFor(() => expect(card()?.className).not.toMatch(/disabled/));
  });
});
