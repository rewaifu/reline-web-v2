import { For, Portal, Show, signal, useContext } from "reze-js";
import { nodeLabel, nodeMenuEntries, type NodeMenuEntry } from "~/lib/nodes";
import { Icon } from "~/components/ui/icon";
import { createDismissOnOutside } from "~/components/ui/create-dismiss-on-outside";
import { createMenuPosition } from "~/components/ui/menu-position";
import { NodesDispatchContext } from "~/context/contexts";
import { NodesActionType } from "~/types/actions";
import type { StackNode } from "~/types/node";
import type { Component } from "~/types/component";
import { t } from "~/lib/i18n";
import styles from "./node-swap.module.scss";

export interface NodeSwapProps {
  node: StackNode;
  class?: string;
}

/** Swap button + a portaled filter menu: replaces the node's type in place —
 * uid, position and enabled state survive, options reset to the new type's
 * defaults. The option list renders inline in the popover (a nested portaled
 * combobox would die to this popover's own outside-dismiss on option
 * pointerdown, and the click would fall through onto the card underneath).
 * Used by the node list row, the stack card header and the settings panel. */
export const NodeSwap: Component<NodeSwapProps> = (props) => {
  const dispatch = useContext(NodesDispatchContext);
  let open = signal(false);
  let query = signal("");
  let active = signal(0);
  // the outside-dismiss and positioning helpers track these, so they are
  // signals: the effect re-runs when the popover mounts
  let btnEl = signal<HTMLButtonElement | undefined>(undefined);
  let popEl = signal<HTMLDivElement | undefined>(undefined);
  let inputEl: HTMLInputElement | undefined;
  let listEl: HTMLUListElement | undefined;

  createDismissOnOutside(
    () => open,
    (value) => (open = value),
    () => [btnEl, popEl],
  );
  createMenuPosition(
    () => open,
    () => btnEl,
    () => popEl,
    () => "bottom-start",
  );

  const matches = () => {
    const q = query.trim().toLowerCase();
    // the current type is meaningless as a replacement
    const all = nodeMenuEntries(props.node.type);
    if (q === "") return all;
    return all.filter((entry) => entry.text.toLowerCase().includes(q));
  };

  const openMenu = () => {
    query = "";
    active = 0;
    open = true;
    requestAnimationFrame(() => inputEl?.focus());
  };

  const closeMenu = () => {
    open = false;
    btnEl?.focus();
  };

  const swap = (entry: NodeMenuEntry | undefined) => {
    if (entry === undefined || entry.type === props.node.type) return;
    dispatch({
      type: NodesActionType.SWAP,
      payload: { uid: props.node.uid, nodeType: entry.type },
    });
    open = false;
  };

  const scrollActive = () => {
    requestAnimationFrame(() => {
      listEl
        ?.querySelector("[data-active]")
        ?.scrollIntoView({ block: "nearest" });
    });
  };

  const onInputKeyDown = (e: KeyboardEvent) => {
    const list = matches();
    if (e.key === "Escape") {
      closeMenu();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (list.length === 0) return;
      active = Math.min(
        list.length - 1,
        Math.max(0, active + (e.key === "ArrowDown" ? 1 : -1)),
      );
      scrollActive();
    } else if (e.key === "Enter") {
      e.preventDefault();
      swap(list[active] ?? list[0]);
    }
  };

  return (
    <div class={[styles.swap, props.class]}>
      <button
        ref={(el) => (btnEl = el)}
        type="button"
        class={styles.button}
        aria-label={t("chrome.swapNamed", {
          name: props.node.name ?? nodeLabel(props.node.type),
        })}
        title={t("chrome.swap")}
        aria-expanded={open ? "true" : "false"}
        aria-haspopup="listbox"
        onPointerDown={(e) => e.preventDefault()}
        onClick={(e) => {
          // the list row and the card header fold/select on click — the swap
          // button keeps its own zone, like rename and remove do
          e.stopPropagation();
          if (open) closeMenu();
          else openMenu();
        }}
      >
        <Icon name="swap" size={13} />
      </button>
      <Show when={open}>
        <Portal>
          <div
            ref={(el) => (popEl = el)}
            class={styles.popover}
            style={{ position: "fixed", left: "0px", top: "0px" }}
          >
            <input
              ref={(el) => (inputEl = el)}
              class={styles.filter}
              type="text"
              attr:role="combobox"
              aria-label={t("chrome.swap")}
              aria-expanded="true"
              aria-controls={`${props.node.uid}-swap-list`}
              aria-activedescendant={`${props.node.uid}-swap-list-${active}`}
              autocomplete="off"
              placeholder={t("chrome.swapPick")}
              value={query}
              onInput={(e) => {
                query = e.currentTarget.value;
                active = 0;
              }}
              onKeyDown={onInputKeyDown}
            />
            <ul
              ref={(el) => (listEl = el)}
              id={`${props.node.uid}-swap-list`}
              attr:role="listbox"
              class={styles.list}
            >
              <For each={matches()}>
                {(entry, index) => (
                  <li>
                    <button
                      id={`${props.node.uid}-swap-list-${index}`}
                      type="button"
                      attr:role="option"
                      aria-selected={false}
                      data-active={index === active ? "" : undefined}
                      class={styles.item}
                      onPointerDown={(e) => e.preventDefault()}
                      onPointerMove={() => (active = index)}
                      onClick={() => swap(entry)}
                    >
                      {entry.text}
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </div>
        </Portal>
      </Show>
    </div>
  );
};
