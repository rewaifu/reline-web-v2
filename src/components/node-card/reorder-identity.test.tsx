import { afterEach, describe, expect, it } from "vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
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
import { createDefaultNodes, createNode } from "~/lib/nodes";
import { uiRegistry } from "~/lib/ui/registry";
import { NodeType } from "~/types/enums";

afterEach(cleanup);

const mountStack = () => {
  const nodes = store(createDefaultNodes().slice(0, 4));
  const dispatch = createNodesDispatch(nodes);
  const view = mount(() => {
    const analysis = () => analyze([...nodes]);
    return (
      <NodesContext value={nodes}>
        <NodesDispatchContext value={dispatch}>
          <AnalysisContext value={analysis}>
            <NodeStack
              selectedUid={() => null}
              isSelected={() => false}
              onSelect={() => {}}
              phone={false}
            />
          </AnalysisContext>
        </NodesDispatchContext>
      </NodesContext>
    );
  });
  const cards = () =>
    Array.from(view.el.querySelectorAll<HTMLElement>("[data-node-id]"));
  return { dispatch, cards };
};

/** The stack is keyed by node identity: reordering, adding or deleting moves
 * the existing cards, it never rebuilds them (a rebuilt card loses its form
 * state and focus). */
describe("stack identity", () => {
  it("moves the same card elements", () => {
    const { dispatch, cards } = mountStack();
    const before = cards();
    expect(before).toHaveLength(4);
    dispatch({ type: NodesActionType.MOVE, payload: { from: 1, to: 2 } });
    tick();
    const after = cards();
    expect(after.map((c) => c.dataset.nodeId)).toEqual([
      before[0].dataset.nodeId,
      before[2].dataset.nodeId,
      before[1].dataset.nodeId,
      before[3].dataset.nodeId,
    ]);
    before.forEach((card) => expect(after).toContain(card));
  });

  it("keeps the other cards when one is added or deleted", () => {
    const { dispatch, cards } = mountStack();
    const before = cards();
    const added = createNode(NodeType.LEVEL, false);
    if (added === undefined) throw new Error("no level node");
    dispatch({ type: NodesActionType.ADD, payload: added });
    tick();
    before.forEach((card) => expect(cards()).toContain(card));
    dispatch({
      type: NodesActionType.DELETE,
      payload: before[1].dataset.nodeId!,
    });
    tick();
    [before[0], before[2], before[3]].forEach((card) =>
      expect(cards()).toContain(card),
    );
  });

  it("keeps the cards while an override of the card is active", () => {
    const undo = uiRegistry.override(
      "NodeCard",
      (Previous) => (props) => <Previous {...props} />,
      "acme.wrap",
    );
    try {
      const { dispatch, cards } = mountStack();
      const before = cards();
      expect(before).toHaveLength(4);
      const added = createNode(NodeType.LEVEL, false);
      if (added === undefined) throw new Error("no level node");
      dispatch({ type: NodesActionType.ADD, payload: added });
      dispatch({ type: NodesActionType.MOVE, payload: { from: 0, to: 2 } });
      tick();
      before.forEach((card) => expect(cards()).toContain(card));
    } finally {
      undo();
    }
  });

  it("rebuilds the cards once when the override chain changes", () => {
    const { cards } = mountStack();
    const before = cards();
    const undo = uiRegistry.override(
      "NodeCard",
      (Previous) => (props) => <Previous {...props} />,
      "acme.wrap",
    );
    tick();
    const during = cards();
    expect(during).toHaveLength(4);
    before.forEach((card) => expect(during).not.toContain(card));
    undo();
    tick();
    expect(cards()).toHaveLength(4);
  });
});
