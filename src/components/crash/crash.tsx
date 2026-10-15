import { STORAGE_KEY } from "~/constants";
import type { Component } from "~/types/component";
import { t } from "~/lib/i18n";
import { storage } from "~/lib/storage";
import styles from "./crash.module.scss";

/** Rendered by the workspace error boundary.
 *
 * An uncaught error costs one subtree, and this screen names it — the stack is
 * what makes the next report fixable.
 *
 * There is no "try again" button: a reset only rebuilds what can be rebuilt,
 * and a component that threw on its own state does not come back that way. A
 * reload always does. */
export interface CrashProps {
  error: () => unknown;
}

const describe = (error: unknown): string => {
  if (error instanceof Error) return error.stack ?? error.message;
  return String(error);
};

/** Drop the saved tree: a crashed workspace is most often crashed *by* the
 * config it loaded, and a plain reload would only crash again. Exported
 * without the reload so a test can check what it clears. */
export const clearStoredNodes = (): void => {
  // storage unavailable (private mode): the reload still gets a fresh tree
  storage.remove(STORAGE_KEY);
};

export const Crash: Component<CrashProps> = (props) => {
  const resetNodes = () => {
    if (!window.confirm(t("chrome.crash.resetNodesAsk"))) return;
    clearStoredNodes();
    window.location.reload();
  };

  return (
    <div class={styles.crash} attr:role="alert">
      <p class={styles.title}>{t("chrome.crash.title")}</p>
      <p class={styles.hint}>{t("chrome.crash.hint")}</p>
      <pre class={styles.detail}>{describe(props.error())}</pre>
      <div class={styles.actions}>
        <button
          type="button"
          class={styles.button}
          onClick={() => window.location.reload()}
        >
          {t("chrome.crash.reload")}
        </button>
        <button type="button" class={styles.button} onClick={resetNodes}>
          {t("chrome.crash.resetNodes")}
        </button>
      </div>
    </div>
  );
};
