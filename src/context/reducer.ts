import {
  type AnyAction,
  type NodesAction,
  NodesActionType,
} from "~/types/actions";
import { notifyObservers, storeActions } from "~/context/actions";
import { defaultOptions } from "~/lib/nodes";
import { sanitizeNode, sanitizeNodes } from "~/lib/node-shape";
import { pipeline } from "~/lib/pipeline/hooks";
import { withFreshUids } from "~/lib/uid";
import type { StackNode } from "~/types/node";

const BUILTIN: ReadonlySet<string> = new Set(Object.values(NodesActionType));

/** Writes `next` into the stack in place: the stored array keeps its identity,
 * and every element that is still in `next` keeps its object reference. */
const replaceAll = (nodes: StackNode[], next: StackNode[]): void => {
  if (next === nodes) return;
  nodes.splice(0, nodes.length, ...next);
};

/**
 * Store transitions — persistence is observed in `App`, not here.
 *
 * Every action takes the same road: the `store.action` hooks may rewrite or
 * refuse it, then it is applied (the editor's own by `processAction`, a
 * plugin's by the reducer it registered), then observers hear about it. An
 * action that throws while being applied — a plugin's reducer, a hook that
 * returned a malformed payload — is recorded and dropped; it must not take the
 * caller (an event handler, a microtask) down with it.
 */
export const createNodesDispatch = (nodes: StackNode[]) => {
  return (action: AnyAction) => {
    const accepted = pipeline.filter("store.action", action);
    if (accepted === null) return;
    try {
      if (BUILTIN.has(accepted.type))
        processAction(nodes, accepted as NodesAction);
      else {
        const reducer = storeActions.get(accepted.type);
        if (reducer === undefined) return;
        const result = reducer(nodes, accepted.payload);
        if (result !== undefined) replaceAll(nodes, result);
      }
    } catch (error) {
      pipeline.report("store.reducer", accepted.type, error);
      return;
    }
    notifyObservers(accepted);
  };
};

const processAction = (nodes: StackNode[], action: NodesAction): void => {
  const { type, payload } = action;

  switch (type) {
    case NodesActionType.CHANGE: {
      const index = nodes.findIndex((node) => node.uid === payload.uid);
      if (index === -1) break;
      // merge in place: assigning nodes[index] = payload would swap the item
      // reference, and <For> (keyed by reference) would remount the whole
      // card — every keystroke dropped input focus
      const { uid: _uid, options, ext, ...rest } = payload;
      if (options !== undefined) Object.assign(nodes[index].options, options);
      // plugin data merges per plugin id, like options per key: one plugin
      // writing its slot must not wipe another's
      if (ext !== undefined) {
        nodes[index].ext ??= {};
        Object.assign(nodes[index].ext, ext);
      }
      Object.assign(nodes[index], rest);
      break;
    }

    case NodesActionType.MOVE: {
      const [moved] = nodes.splice(payload.from, 1);
      if (!moved) break;
      nodes.splice(payload.to, 0, moved);
      // survivors keep their object references: <For> moves the existing
      // DOM nodes instead of unmounting and remounting every row, and the
      // FLIP animation only has to tween positions, not rebuild cards
      break;
    }

    case NodesActionType.ADD: {
      // Parsed even here: a pasted config reaches the store through this case,
      // and a node whose shape nothing checked throws later, during render.
      const node = sanitizeNode(payload);
      if (node === undefined) break;
      // a keyed index write: only the new slot notifies, the rest of the
      // stack is untouched
      nodes[nodes.length] = node;
      break;
    }

    case NodesActionType.DELETE:
      // filter keeps every survivor's reference — no remounts, and nothing
      // needs reindexing: uid is the identity, position is the For accessor
      replaceAll(
        nodes,
        nodes.filter((node) => node.uid !== payload),
      );
      break;

    case NodesActionType.SWAP: {
      // replace the type in place: uid, position and enabled stay, options
      // reset to the new type's defaults — mixing option bags across types
      // would leave fields the new form never reads
      const fresh = defaultOptions(payload.nodeType);
      if (fresh === undefined) break;
      const index = nodes.findIndex((node) => node.uid === payload.uid);
      if (index === -1) break;
      // keyed index writes, not a replaced array: only the touched node
      // notifies (see ADD above)
      nodes[index].type = payload.nodeType;
      nodes[index].options = fresh;
      break;
    }

    case NodesActionType.NORMALIZE:
      for (const node of nodes) {
        if (node.type !== payload) continue;
        // the same check any node of this type gets at the door; merged in
        // place for the reason CHANGE is (the card must not remount)
        const fresh = sanitizeNode({
          type: node.type,
          options: node.options,
        });
        if (fresh !== undefined) Object.assign(node.options, fresh.options);
      }
      break;

    case NodesActionType.IMPORT: {
      // imports are the most untrusted input there is: presets, pasted configs
      // and legacy files all land here
      // a plugin may migrate what an import carries first (renamed types, old
      // option shapes); the built-in check still runs on whatever it returns
      const imported = sanitizeNodes(
        pipeline.apply("import.sanitize", payload),
      );
      if (imported.length === 0) break;
      replaceAll(nodes, withFreshUids(imported));
      break;
    }

    default:
      break;
  }
};
