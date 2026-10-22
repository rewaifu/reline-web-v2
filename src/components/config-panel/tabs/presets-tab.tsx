import {
  For,
  Show,
  effect,
  selector,
  signal,
  untrack,
  useContext,
} from "reze-js";
import { NodesContext, NodesDispatchContext } from "~/context/contexts";
import { NodesActionType } from "~/types/actions";
import type { Component } from "~/types/component";
import {
  allPresets,
  saveUserPreset,
  deletePreset,
  hiddenStockCount,
  presetsDisk,
  restoreStockPresets,
  syncPresets,
} from "~/lib/presets";
import { endpointConfigured } from "~/lib/ws";
import { render as localText, t } from "~/lib/i18n";
import { Icon } from "~/components/ui";
import styles from "../config-panel.module.scss";

export const PresetsTab: Component = () => {
  const nodes = useContext(NodesContext);
  const dispatch = useContext(NodesDispatchContext);
  let presetId = signal<string>();
  let name = signal("");
  const isActive = selector(() => presetId);

  // Opening the tab brings the presets and the runner's folder together — but
  // only for a runner the user chose: a page that dialled the default address
  // unasked would knock on 127.0.0.1 of every visitor.
  effect(() => {
    untrack(() => {
      if (endpointConfigured() && presetsDisk() === "idle") void syncPresets();
    });
  });

  const applyPreset = (id: string) => {
    const preset = allPresets().find((p) => p.id === id);
    if (!preset) return;
    presetId = id;
    dispatch({
      type: NodesActionType.IMPORT,
      payload: preset.nodes.map((n) => ({ ...n })),
    });
  };

  const saveCurrent = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const preset = saveUserPreset(trimmed, [...nodes]);
    name = "";
    presetId = preset.id;
  };

  return (
    <div class={styles.presets}>
      <div class={styles.presetSave}>
        <input
          class={styles.presetNameInput}
          placeholder={t("panel.presets.namePlaceholder")}
          aria-label={t("panel.presets.namePlaceholder")}
          value={name}
          onInput={(e) => (name = e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && saveCurrent()}
        />
        <button
          type="button"
          class={styles.presetSaveBtn}
          disabled={!name.trim()}
          onClick={saveCurrent}
        >
          {t("panel.presets.save")}
        </button>
      </div>
      <div class={styles.presetDisk} data-state={presetsDisk()}>
        <span class={styles.presetDiskText}>
          {t(`panel.presets.disk.${presetsDisk()}`)}
        </span>
        <button
          type="button"
          class={styles.presetDiskSync}
          disabled={presetsDisk() === "syncing"}
          aria-label={t("panel.presets.disk.sync")}
          title={t("panel.presets.disk.sync")}
          onClick={() => void syncPresets()}
        >
          <Icon name="refresh" size={14} />
        </button>
      </div>
      <For each={allPresets()}>
        {(preset) => (
          <div
            class={{
              [styles.preset]: true,
              [styles.active]: isActive(preset.id),
            }}
          >
            <button
              type="button"
              class={styles.presetApply}
              onClick={() => applyPreset(preset.id)}
            >
              <span class={styles.presetName}>{preset.name}</span>
              <span class={styles.presetDesc}>
                {localText(preset.description)}
              </span>
            </button>
            <button
              type="button"
              class={styles.presetDelete}
              aria-label={t("panel.presets.removeNamed", {
                name: preset.name,
              })}
              title={t(
                preset.id.startsWith("user-")
                  ? "panel.presets.remove"
                  : "panel.presets.hide",
              )}
              onClick={() => deletePreset(preset.id)}
            >
              <Icon name="x" size={13} />
            </button>
          </div>
        )}
      </For>
      <Show when={hiddenStockCount() > 0}>
        <button
          type="button"
          class={styles.presetRestore}
          onClick={restoreStockPresets}
        >
          {t("panel.presets.restore", { count: hiddenStockCount() })}
        </button>
      </Show>
    </div>
  );
};
