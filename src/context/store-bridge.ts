import { nodeRegistry } from "~/lib/nodes";
import { NodesActionType, type AnyAction } from "~/types/actions";
import type { StackNode } from "~/types/node";

/**
 * The stack outside the component tree. Components read it from context; the
 * code that is not one — a plugin's activation, a hook — has no provider to
 * ask, so the app binds the one store it owns here, once.
 */
interface Bound {
  nodes: StackNode[];
  dispatch: (action: AnyAction) => void;
}

let bound: Bound | undefined;

export const bindStore = (
  nodes: StackNode[],
  dispatch: (action: AnyAction) => void,
): (() => void) => {
  const mine: Bound = { nodes, dispatch };
  bound = mine;
  // A node whose type had no definition was kept as an orphan with its options
  // verbatim. When the definition arrives (a plugin switched on), the node must
  // get what `sanitizeNode` gives any node of that type — defaults for what it
  // lacks, a repaired field for what the schema rejects. Deferred to a
  // microtask: the definition is usually made in the middle of a plugin's
  // activation, and the stack must not be rewritten while that code is still
  // running.
  const stop = nodeRegistry.subscribe((type) => {
    queueMicrotask(() => {
      if (bound === mine)
        dispatch({ type: NodesActionType.NORMALIZE, payload: type });
    });
  });
  return () => {
    stop();
    if (bound === mine) bound = undefined;
  };
};

const current = (): Bound => {
  if (bound === undefined) throw new Error("the stack is not bound yet");
  return bound;
};

/** The live stack store (reads are reactive inside a tracking scope). */
export const stackNodes = (): StackNode[] => current().nodes;

/** Send an action through the same door the editor uses: `store.action`
 * hooks, the reducer, observers. */
export const dispatchAction = (action: AnyAction): void => {
  current().dispatch(action);
};
