import { describe, expect, it } from "vitest";
import { store } from "reze-js";
import { tick } from "@rezejs/testing-library";
import { createNodesDispatch } from "~/context/reducer";
import { NodesActionType } from "~/types/actions";
import type { StackNode } from "~/types/node";
import type { SharpNodeOptions } from "~/types/options";
import { NodeType } from "~/types/enums";
import type { AnyAction } from "~/types/actions";

/**
 * Invariants of the uid-identity reducer: actions address nodes by uid,
 * survivors keep their object reference (so keyed rendering never remounts),
 * and imports never reuse serialized identity.
 */
const node = (uid: string, black: number): StackNode => ({
  uid,
  type: NodeType.SHARP,
  options: {
    low_input: 2,
    high_input: 253,
    gamma: 1,
    diapason_white: 2,
    diapason_black: black,
    canny: true,
    canny_type: "unsharp",
  } as StackNode["options"],
  collapsed: false,
});

/** The fixtures are all SHARP nodes; the store types options as a union. */
const sharp = (n: StackNode) => n.options as SharpNodeOptions;

const withStore = (
  fn: (ctx: {
    nodes: StackNode[];
    dispatch: (action: AnyAction) => void;
  }) => void,
  seed?: StackNode[],
) => {
  const nodes = store<StackNode[]>(
    seed ?? [node("u1", -1), node("u2", -5)],
  );
  fn({ nodes, dispatch: createNodesDispatch(nodes) });
};

describe("reducer: uid is the only identity", () => {
  it("CHANGE merges options in place and notifies readers", () => {
    withStore(({ nodes, dispatch }) => {
      const seen: number[] = [];
      const read = () => sharp(nodes[0]).diapason_black;
      seen.push(read());
      dispatch({
        type: NodesActionType.CHANGE,
        payload: { uid: "u1", options: { diapason_black: -12 } },
      });
      tick();
      seen.push(read());
      expect(seen).toEqual([-1, -12]);
      expect(sharp(nodes[1]).diapason_black).toBe(-5);
      expect(nodes[0].uid).toBe("u1");
    });
  });

  it("CHANGE ignores unknown uids", () => {
    withStore(({ nodes, dispatch }) => {
      dispatch({
        type: NodesActionType.CHANGE,
        payload: { uid: "nope", options: { diapason_black: 99 } },
      });
      tick();
      expect(sharp(nodes[0]).diapason_black).toBe(-1);
    });
  });

  it("DELETE drops the addressed node and keeps survivor identity", () => {
    withStore(({ nodes, dispatch }) => {
      const first = nodes[0];
      dispatch({ type: NodesActionType.DELETE, payload: "u2" });
      tick();
      expect(nodes.length).toBe(1);
      expect(nodes[0]).toBe(first);
    });
  });

  it("MOVE reorders without cloning survivors", () => {
    withStore(({ nodes, dispatch }) => {
      const [first, second] = [nodes[0], nodes[1]];
      dispatch({ type: NodesActionType.MOVE, payload: { from: 0, to: 1 } });
      tick();
      expect(nodes[0]).toBe(second);
      expect(nodes[1]).toBe(first);
    });
  });

  it("ADD appends the node untouched — its uid is its identity", () => {
    withStore(({ nodes, dispatch }) => {
      const added = node("u3", 3);
      dispatch({ type: NodesActionType.ADD, payload: added });
      tick();
      expect(nodes.length).toBe(3);
      expect(nodes[2].uid).toBe("u3");
      expect(sharp(nodes[2]).diapason_black).toBe(3);
    });
  });

  it("IMPORT mints fresh uids and never reuses the payload's", () => {
    withStore(({ nodes, dispatch }) => {
      const before = [nodes[0], nodes[1]].map((n) => n.uid);
      dispatch({
        type: NodesActionType.IMPORT,
        payload: [node("u1", 1), node("u1", 2)],
      });
      tick();
      expect(nodes.length).toBe(2);
      const uids = nodes.map((n) => n.uid);
      expect(new Set(uids).size).toBe(2);
      for (const uid of uids) expect(before).not.toContain(uid);
      // options still come from the payload
      expect(nodes.map((n) => sharp(n).diapason_black)).toEqual([1, 2]);
    });
  });

  it("SWAP replaces the type in place and resets options to defaults", () => {
    withStore(({ nodes, dispatch }) => {
      const survivor = nodes[1];
      dispatch({
        type: NodesActionType.SWAP,
        payload: { uid: "u1", nodeType: NodeType.RESIZE },
      });
      tick();
      expect(nodes.length).toBe(2);
      // uid, position and the survivor's reference survive the swap
      expect(nodes[0].uid).toBe("u1");
      expect(nodes[1]).toBe(survivor);
      expect(nodes[0].type).toBe(NodeType.RESIZE);
      // options are the new type's defaults, not merged leftovers
      expect(sharp(nodes[0] as StackNode).diapason_black).toBeUndefined();
      expect(nodes[0].options).toMatchObject({ filter: "slinear4" });
    });
  });
  it("SWAP turns an orphan node into a defined type, and refuses an undefined one", () => {
    const orphan: StackNode = {
      uid: "o1",
      type: "acme.gone",
      options: { keep: "me" },
      collapsed: false,
    };
    withStore(
      ({ nodes, dispatch }) => {
        dispatch({
          type: NodesActionType.SWAP,
          payload: { uid: "o1", nodeType: "acme.also-gone" },
        });
        tick();
        // swapping to a type with no definition would invent options: no-op
        expect(nodes[0].type).toBe("acme.gone");
        expect(nodes[0].options).toEqual({ keep: "me" });
        dispatch({
          type: NodesActionType.SWAP,
          payload: { uid: "o1", nodeType: NodeType.LEVEL },
        });
        tick();
        expect(nodes[0].type).toBe(NodeType.LEVEL);
        expect(nodes[0].options).toMatchObject({ high_output: 255 });
      },
      [orphan],
    );
  });
});
