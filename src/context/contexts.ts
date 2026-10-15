import { createContext } from "reze-js";
import type { Analysis } from "~/lib/config";
import type { StackNode } from "~/types/node";
import type { NodesAction } from "~/types/actions";

export type NodesStore = StackNode[];
export type NodesDispatch = (action: NodesAction) => void;

// Default-less contexts: reading them without a Provider is a bug, not a
// maybe. `useContext` throws `ContextNotFoundError` on its own — no wrapper
// hooks, no null checks.
export const NodesContext = createContext<NodesStore>();
export const NodesDispatchContext = createContext<NodesDispatch>();

/** The serialised and validated stack, computed once for the whole app: the
 * Code tab, the node cards and the run tab all read this one memo. */
export const AnalysisContext = createContext<() => Analysis>();
