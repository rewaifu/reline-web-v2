import {
  For,
  computed,
  effect,
  splitProps,
  onCleanup,
  signal,
  untrack,
  type JSX,
} from "reze-js";
import type { Component } from "~/types/component";
import { Tabs } from "@rebase-ui/reze/tabs";
import { render, t, type LocalText } from "~/lib/i18n";
import { UiSelect } from "../select/select";
import { fitTabs } from "./fit";
import styles from "./tabs.module.scss";

export interface UiTabDef {
  value: string;
  /** Not formatted text: the label has to follow the language, and a tab list
   * is often a module-level constant. A dictionary key, or `raw()` for a
   * plugin's. */
  label: LocalText;
}

export interface UiTabsProps {
  value: string;
  onChange: (value: string) => void;
  tabs: readonly UiTabDef[];
  content: (value: string) => JSX.Element;
  class?: string;
}

const sameSet = (a: ReadonlySet<number> | undefined, b: ReadonlySet<number>) =>
  a !== undefined && a.size === b.size && [...b].every((i) => a.has(i));

/**
 * One row of tabs. What does not fit (plugins add their own, the panel is
 * narrow) moves into a burger menu at the end of the row; the selected tab
 * always stays on the row, so choosing one from the menu swaps it in. Tabs are
 * measured at their natural width while all of them stay mounted — the ones
 * in the menu are only taken out of the flow, so they keep their place in the
 * tab list for the roving focus and the panel wiring.
 */
export const UiTabs: Component<UiTabsProps> = (props) => {
  const [, rest] = splitProps(props, [
    "value",
    "onChange",
    "tabs",
    "content",
    "class",
  ]);
  // indexes kept on the row; undefined until measured (everything shows)
  let kept = signal<ReadonlySet<number> | undefined>(undefined);
  let strip = signal<HTMLDivElement | undefined>(undefined);
  let list = signal<HTMLDivElement | undefined>(undefined);
  let burger = signal<HTMLButtonElement | undefined>(undefined);

  const onRow = (index: number) => kept?.has(index) ?? true;
  const overflow = computed(
    props.tabs.flatMap((tab, i) => (onRow(i) ? [] : [tab])),
  );
  const labelOf = (value: string) => {
    const tab = props.tabs.find((candidate) => candidate.value === value);
    return tab === undefined ? value : render(tab.label);
  };

  const measure = (selected: string, tabs: readonly UiTabDef[]) => {
    if (strip === undefined || list === undefined || burger === undefined)
      return;
    const triggers = [...list.querySelectorAll<HTMLElement>('[role="tab"]')];
    const next = fitTabs({
      widths: triggers.map((trigger) => trigger.offsetWidth),
      active: tabs.findIndex((tab) => tab.value === selected),
      available: strip.clientWidth,
      gap: parseFloat(getComputedStyle(list).columnGap) || 0,
      menu: burger.offsetWidth,
    });
    if (!sameSet(kept, next)) kept = next;
  };

  // re-fit when the selection or the tab set changes (the refs arrive after
  // mount, so the strip, the row and the burger are read to subscribe to them);
  // label width changes reach the observer through the tabs' own sizes
  effect(() => {
    const selected = props.value;
    const tabs = props.tabs;
    const bar = strip;
    const row = list;
    if (bar === undefined || row === undefined || burger === undefined) return;
    untrack(() => {
      measure(selected, tabs);
      // whenever the strip or any tab changes size (window, fonts, wording)
      const observer = new ResizeObserver(() =>
        measure(props.value, props.tabs),
      );
      observer.observe(bar);
      for (const trigger of row.querySelectorAll('[role="tab"]'))
        observer.observe(trigger);
      onCleanup(() => observer.disconnect());
    });
  });

  return (
    <Tabs.Root
      {...rest}
      class={[styles.tabs, props.class]}
      value={props.value}
      onValueChange={(value) => props.onChange(value)}
    >
      <div ref={(el) => (strip = el)} class={styles.strip}>
        <Tabs.List ref={(el) => (list = el)} class={styles.list}>
          <For each={props.tabs}>
            {(tab, index) => (
              <Tabs.Tab
                value={tab.value}
                class={styles.trigger}
                // out of the flow, unfocusable and skipped by the arrow keys
                disabled={!onRow(index)}
                data-overflow={onRow(index) ? undefined : ""}
              >
                {/* the tab reads its children once: the fragment's binding is
                    what follows a language switch */}
                <>{render(tab.label)}</>
              </Tabs.Tab>
            )}
          </For>
        </Tabs.List>
        <UiSelect
          ref={(el) => (burger = el)}
          variant="icon"
          class={styles.burger}
          // measured while idle, so it stays in the DOM and only leaves the flow
          data-idle={overflow.length === 0 ? "" : undefined}
          value={null}
          items={overflow.map((tab) => tab.value)}
          itemLabel={labelOf}
          onChange={props.onChange}
          ariaLabel={t("ui.moreTabs")}
        />
      </div>
      <Tabs.Panel value={props.value} class={styles.content}>
        {/* the panel reads its children once: the fragment's own binding is what
            follows the selected value */}
        <>{props.content(props.value)}</>
      </Tabs.Panel>
    </Tabs.Root>
  );
};
