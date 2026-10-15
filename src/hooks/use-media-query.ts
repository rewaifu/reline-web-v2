import { effect, onCleanup, signal } from "reze-js";

/**
 * Reactive `matchMedia`: the signal follows the live query, so rotating a
 * phone or resizing a window re-evaluates the layout without a reload.
 * `window` is read lazily — the initial value is computed on the client.
 */
export const createMediaQuery = (query: string): (() => boolean) => {
  let matches = signal(window.matchMedia(query).matches);
  effect(() => {
    const list = window.matchMedia(query);
    const sync = () => {
      matches = list.matches;
    };
    // the query may have changed between the first render and the effect
    sync();
    list.addEventListener("change", sync);
    onCleanup(() => list.removeEventListener("change", sync));
  });
  return () => matches;
};
