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
import { createDefaultNodes } from "~/lib/nodes";

afterEach(cleanup);

/** The stack is keyed by node identity: reordering moves the existing cards,
 * it never rebuilds them (a rebuilt card loses its form state and focus). */
describe("stack reorder", () => {
  it("moves the same card elements", () => {
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
});
