import { For, Show, effect, signal, untrack, useContext } from "reze-js";
import type { Component } from "~/types/component";
import {
  AnalysisContext,
  NodesContext,
  NodesDispatchContext,
} from "~/context/contexts";
import { NodesActionType } from "~/types/actions";
import type { StackNode } from "~/types/node";
import { createDragReorder, type DragHandlers } from "~/hooks/use-drag-reorder";
import { flipReorder } from "~/hooks/use-flip-reorder";
import { useToggleEnabled } from "~/hooks/use-node-actions";
import { nodeLabel } from "~/lib/nodes";
import { NodeOptionsForm } from "~/components/nodes/node-options-form";
import { Slot } from "~/components/slot/slot";
import { overridable } from "~/components/slot/overridable";
import { NodeSwap } from "~/components/node-swap/node-swap";
import { DiagnosticList } from "~/components/diagnostics/diagnostic-list";
import { Icon, UiSwitch } from "~/components/ui";
import { t } from "~/lib/i18n";
import styles from "./node-card.module.scss";

export interface NodeCardProps {
  /** The row's node object, handed straight down from <For> — no re-find by id. */
  node: StackNode;
  /** Position in the stack — drag state is index-based. */
  index: number;
  /** Selection state of this row (a selector built once by the stack). */
  selected: boolean;
  onSelect: (uid: string) => void;
  dragIndex: () => number | null;
  dropIndex: () => number | null;
  handlers: (index: number) => DragHandlers;
  /** Phone: the node list is hidden, so its enable switch lives on the card. */
  phone: boolean;
}

const NodeBody = overridable("NodeBody", NodeOptionsForm);

const NodeCardImpl: Component<NodeCardProps> = (props) => {
  const dispatch = useContext(NodesDispatchContext);
  const toggleEnabled = useToggleEnabled();
  const analysis = useContext(AnalysisContext);
  let editing = signal(false);
  let draft = signal("");
  let renameInput: HTMLInputElement | undefined;

  const findings = () => analysis().byUid.get(props.node.uid) ?? [];
  // the worst finding tints the card edge, so a folded card still says so
  const worst = () =>
    findings().some((d) => d.severity === "error")
      ? "error"
      : findings().length > 0
        ? "warn"
        : undefined;

  const change = (patch: Partial<StackNode>) => {
    dispatch({
      type: NodesActionType.CHANGE,
      payload: { uid: props.node.uid, ...patch },
    });
  };

  const startRename = () => {
    draft = props.node.name ?? "";
    editing = true;
  };

  const commitRename = () => {
    const value = draft.trim();
    change({ name: value === "" ? undefined : value });
    editing = false;
  };

  return (
    <>
      <div
        class={{
          [styles.dropPlaceholder]: true,
          [styles.visible]: props.dropIndex() === props.index,
        }}
      />
      <section
        data-node-id={props.node.uid}
        data-flip-key={props.node.uid}
        data-diagnostics={worst()}
        class={{
          [styles.card]: true,
          [styles.selected]: props.selected,
          [styles.disabled]: props.node.enabled === false,
          [styles.dragging]: props.dragIndex() === props.index,
        }}
        onClick={() => props.onSelect(props.node.uid)}
      >
        <header
          class={styles.header}
          onClick={(e) => {
            props.onSelect(props.node.uid);
            // A single click anywhere on the strip folds the node — the name
            // included. The title is `flex: 1`, so the empty stretch beside
            // the name is part of it; no handler on the title may stop the
            // event there, or the first click would be swallowed. Only the
            // grip is left out: a press there is a drag, and a drop would
            // otherwise fold the card it just dropped.
            if (
              e.target instanceof Element &&
              e.target.closest("[data-drag-handle]") !== null
            )
              return;
            change({ collapsed: !props.node.collapsed });
          }}
        >
          <span
            class={styles.dragHandle}
            data-drag-handle
            attr:role="button"
            tabindex="0"
            aria-label={t("chrome.reorder")}
            title={t("chrome.reorderTitle")}
            {...props.handlers(props.index)}
          >
            <Icon name="drag-drop" size={18} />
          </span>
          {/* The enable switch lives on the card on every width: the node list
              that used to carry it is closed by default, and on a phone it
              does not exist at all. */}
          <span
            class={styles.enable}
            onClick={(e) => e.stopPropagation()}
            onDblClick={(e) => e.stopPropagation()}
          >
            <UiSwitch
              checked={props.node.enabled !== false}
              onChange={(enabled) => toggleEnabled(props.node, enabled)}
              ariaLabel={t("chrome.enable", {
                name: props.node.name ?? nodeLabel(props.node.type),
              })}
            />
          </span>
          <button
            type="button"
            class={styles.iconBtn}
            aria-label={t("chrome.rename")}
            title={t("chrome.rename")}
            onClick={(e) => {
              e.stopPropagation();
              startRename();
            }}
          >
            <Icon name="pencil" size={13} />
          </button>
          <Show
            when={!editing}
            fallback={
              <input
                ref={(el) => {
                  renameInput = el;
                  // the input mounts on demand: focus and select the text once
                  // it is in the document, so typing replaces the name right away
                  queueMicrotask(() => {
                    el.focus();
                    el.select();
                  });
                }}
                class={styles.renameInput}
                value={draft}
                placeholder={props.node.name ?? nodeLabel(props.node.type)}
                aria-label={t("chrome.nodeName")}
                onClick={(e) => e.stopPropagation()}
                onInput={(e) => (draft = e.currentTarget.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  else if (e.key === "Escape") editing = false;
                }}
              />
            }
          >
            {/* No handler of its own: selecting and folding are the header's
                job, and a handler here would have to stop the event to keep
                its own zone — which is exactly what broke the first click. */}
            <span class={styles.title}>
              <span class={styles.titleText}>
                {props.node.name ?? nodeLabel(props.node.type)}
              </span>
              <Show when={props.node.name}>
                <span class={styles.typeHint}>
                  {nodeLabel(props.node.type)}
                </span>
              </Show>
            </span>
          </Show>
          <Slot name="node.card.header" context={{ node: props.node }} />
          <NodeSwap node={props.node} />
          <Show when={!props.phone}>
            <button
              type="button"
              class={styles.iconBtn}
              aria-label={t("chrome.remove")}
              title={t("chrome.remove")}
              onClick={(e) => {
                e.stopPropagation();
                dispatch({
                  type: NodesActionType.DELETE,
                  payload: props.node.uid,
                });
              }}
            >
              <Icon name="trash" size={13} />
            </button>
          </Show>
          <button
            type="button"
            class={styles.chevron}
            aria-label={t("chrome.collapse")}
            aria-expanded={props.node.collapsed === false ? "true" : "false"}
            onClick={(e) => {
              e.stopPropagation();
              change({ collapsed: !props.node.collapsed });
            }}
          >
            <Icon
              name={
                props.node.collapsed === false ? "chevron-down" : "chevron-right"
              }
              size={14}
            />
          </button>
        </header>
        <Show when={props.node.collapsed === false}>
          <div class={styles.separator} attr:role="separator" />
          {/* Destructive action, phone edition: out of the always-visible
              strip (where a stray thumb costs a node) and into the expanded
              body, with a label that says what it deletes. */}
          <Show when={props.phone}>
            <div class={styles.cardActions}>
              <button
                type="button"
                class={styles.deleteBtn}
                aria-label={t("chrome.remove")}
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({
                    type: NodesActionType.DELETE,
                    payload: props.node.uid,
                  });
                }}
              >
                <Icon name="trash" size={16} />
                {t("chrome.remove")}
              </button>
            </div>
          </Show>
          <DiagnosticList items={findings()} class={styles.findings} />
          <NodeBody node={props.node} />
          <Slot name="node.card.footer" context={{ node: props.node }} />
        </Show>
      </section>
    </>
  );
};

const NodeCardView = overridable("NodeCard", NodeCardImpl);

export interface NodeCardsProps {
  selectedUid: () => string | null;
  /** Per-row selection check: only the rows whose state changes re-render on
   * a click (a selector built once by the caller). */
  isSelected: (uid: string) => boolean;
  onSelect: (uid: string) => void;
  /** Phone: there is no node list, so the card carries what the list did. */
  phone: boolean;
}
export const NodeStack: Component<NodeCardsProps> = (props) => {
  const nodes = useContext(NodesContext);
  const dispatch = useContext(NodesDispatchContext);
  // the drag hook tracks the container, so it is a signal the ref writes
  let stack = signal<HTMLDivElement | undefined>(undefined);
  const { dragIndex, dropIndex, handlers } = createDragReorder(
    () => stack,
    (from, to) => {
      flipReorder(
        stack,
        "[data-flip-key]",
        () => {
          dispatch({ type: NodesActionType.MOVE, payload: { from, to } });
          // uid is the identity: the moved node keeps it, selection follows
          // automatically and no row remounts
        },
        (el) => el.getAttribute("data-flip-key"),
      );
    },
  );

  // selecting a node in the left list scrolls its card into view. Deferred to a
  // microtask: the stack element is only set once it has rendered.
  effect(() => {
    const uid = props.selectedUid();
    if (uid === null) return;
    queueMicrotask(() => {
      const el = untrack(() => stack);
      if (el === undefined) return;
      const card = el.querySelector(`[data-node-id="${uid}"]`);
      if (card === null) return;
      // a click on the card itself selects too — scrolling a visible card
      // would glide the layout mid double-click and kill the rename; reveal
      // only cards that are (partially) outside the stack viewport
      const rect = card.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      if (rect.top >= box.top && rect.bottom <= box.bottom) return;
      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });

  return (
    <>
      <div class={styles.stack} ref={(el) => (stack = el)}>
        <For each={nodes}>
          {(node, index) => (
            <NodeCardView
              node={node}
              index={index}
              selected={props.isSelected(node.uid)}
              onSelect={props.onSelect}
              dragIndex={dragIndex}
              dropIndex={dropIndex}
              handlers={handlers}
              phone={props.phone}
            />
          )}
        </For>
        <div
          class={{
            [styles.dropPlaceholder]: true,
            [styles.visible]: dropIndex() === nodes.length,
          }}
        />
      </div>
      <Slot name="stack.footer" />
    </>
  );
};
