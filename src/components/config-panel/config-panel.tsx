import { computed, dynamic, effect, Show, signal, untrack } from "reze-js";
import { Errored } from "~/components/errored/errored";
import { UiTabs } from "~/components/ui";
import type { Component } from "~/types/component";
import { pipeline } from "~/lib/pipeline/hooks";
import { uiRegistry } from "~/lib/ui/registry";
import { pluginRuntime } from "~/lib/plugins/runtime";
import "./builtin-tabs";
import styles from "./config-panel.module.scss";

export interface ConfigPanelProps {
  selectedUid: () => string | null;
}

const FALLBACK_TAB = "code";

/** The settings panel: a tab strip over whatever the panel registry holds — the
 * host's four tabs and any a plugin added. Each tab renders inside its own error
 * boundary, so a plugin tab that throws costs that tab, not the panel. */
export const ConfigPanel: Component<ConfigPanelProps> = (props) => {
  let chosen = signal<string>(FALLBACK_TAB);
  // a `?plugin=` link opens the tab that asks the user about it
  effect(() => {
    const link = pluginRuntime.pendingInstall();
    if (link !== undefined) untrack(() => (chosen = "plugins"));
  });
  const tabs = () => uiRegistry.panelTabs();
  // the chosen tab can disappear (its plugin was switched off): fall back
  // instead of showing an empty panel. A computed, not a function: `value` is
  // read inside the panel's children, and a plain function would re-run them
  // (remounting the open tab, state and all) on every registry change — a
  // plugin registering a tab is one — even when the answer is the same tab
  const active = computed(
    tabs().some((tab) => tab.id === chosen) ? chosen : FALLBACK_TAB,
  );

  return (
    <UiTabs
      value={active}
      onChange={(value) => (chosen = value)}
      tabs={tabs().map((tab) => ({ value: tab.id, label: tab.label }))}
      class={styles.panel}
      content={(value) => (
        <Show when={tabs().find((tab) => tab.id === value)}>
          {(tab) => {
            const Body = dynamic(() => tab.Component);
            return (
              <Errored
                fallback={(error) => {
                  pipeline.report("ui", `tab:${tab.id}`, error());
                  return null;
                }}
              >
                <Show
                  when={tab.scroll}
                  fallback={<Body selectedUid={props.selectedUid} />}
                >
                  <div class={styles.tabScroll}>
                    <Body selectedUid={props.selectedUid} />
                  </div>
                </Show>
              </Errored>
            );
          }}
        </Show>
      )}
    />
  );
};
