import { For } from "reze-js";
import { Errored } from "~/components/errored/errored";
import { pipeline } from "~/lib/pipeline/hooks";
import { uiRegistry, type SlotName } from "~/lib/ui/registry";
import type { Component } from "~/types/component";

/** What a slot contribution is rendered as: its own props type was erased when
 * it was stored, and `context` is what the slot's host passes it. */
type Contribution = Component<Record<string, unknown>>;

export interface SlotProps {
  name: SlotName;
  /** Props handed to every contribution of the slot. */
  context?: Record<string, unknown>;
}

/**
 * A place in the host's layout where plugins may put components.
 *
 * Each contribution has its own error boundary: a plugin component that throws
 * while rendering costs its own space, not the screen around it. The boundary
 * also catches errors from bindings and effects created inside the contribution.
 */
export const Slot: Component<SlotProps> = (props) => (
  <For each={uiRegistry.slotEntries(props.name)}>
    {(entry) => {
      // an entry's component never changes, so it is a plain tag: a tag is built
      // inside the boundary, where a throw on the first render is caught
      const Render = entry.Component as unknown as Contribution;
      return (
        <Errored
          fallback={(error: () => unknown) => {
            pipeline.report("ui", `${entry.owner}:${props.name}`, error());
            return null;
          }}
        >
          <Render {...props.context} />
        </Errored>
      );
    }}
  </For>
);
