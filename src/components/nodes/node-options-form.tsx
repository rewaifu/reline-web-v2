import { Show, dynamic } from "reze-js";
import type { Component } from "~/types/component";
import { Errored } from "~/components/errored/errored";
import type { StackNode } from "~/types/node";
import { nodeRegistry } from "~/lib/nodes";
import { pipeline } from "~/lib/pipeline/hooks";
import { t } from "~/lib/i18n";
import "~/nodes/builtin-ui";
import styles from "./forms/forms.module.scss";

export interface NodeFormProps {
  /** The row's node object, handed down from <For> via NodeCard. */
  node: StackNode;
}

/** The body of an expanded card: the form its type's definition carries. An
 * orphan node (its type is not defined — a plugin that is off) and a type
 * without a form get a note instead; the options stay in the tree untouched. */
export const NodeOptionsForm: Component<NodeFormProps> = (props) => {
  // the dynamic component follows the node's type; a falsy source renders nothing
  const Body = dynamic(() => nodeRegistry.get(props.node.type)?.Form);
  return (
    <Show
      when={nodeRegistry.get(props.node.type)?.Form}
      fallback={
        <p class={styles.orphan}>
          {t(
            nodeRegistry.get(props.node.type) === undefined
              ? "form.orphan"
              : "form.noForm",
            { type: props.node.type },
          )}
        </p>
      }
    >
      {/* a node type's form may come from a plugin: a render error costs this
          card its body, not the stack */}
      <Errored
        fallback={(error: () => unknown) => {
          pipeline.report("ui", `form:${props.node.type}`, error());
          return <p class={styles.orphan}>{t("form.broken")}</p>;
        }}
      >
        <Body node={props.node} />
      </Errored>
    </Show>
  );
};
