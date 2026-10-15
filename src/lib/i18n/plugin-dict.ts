import { signal } from "reze-js";
import { locale, type Locale } from "./locale";

/**
 * Words a plugin brings. Kept apart from the built-in dictionaries: those are
 * typed by their dotted path (a typo is a compile error), a plugin's keys exist
 * only at runtime, so they are looked up by plugin id + key and never widen
 * `MessageKey`.
 *
 * Lookup order: the current language, English, any language the plugin has,
 * then the key itself — a missing line shows its key instead of nothing.
 */
type Entries = Readonly<Record<string, string>>;
type PerLocale = Partial<Record<Locale, Entries>>;

// Read straight from the map; the signal only tells subscribers to look again.
const dictionaries = new Map<string, readonly PerLocale[]>();
let version = 0;
let revision = signal(version);

export const pluginDictionary = {
  /** Add words for one language; the disposer takes exactly these back. */
  add(plugin: string, language: Locale, entries: Entries): () => void {
    const layer: PerLocale = { [language]: entries };
    dictionaries.set(plugin, [...(dictionaries.get(plugin) ?? []), layer]);
    revision = ++version;
    return () => {
      const layers = (dictionaries.get(plugin) ?? []).filter(
        (l) => l !== layer,
      );
      if (layers.length === 0) dictionaries.delete(plugin);
      else dictionaries.set(plugin, layers);
      revision = ++version;
    };
  },

  /** The template for a key, in the best language available. Reactive. */
  lookup(plugin: string, key: string): string {
    void revision;
    const layers = dictionaries.get(plugin) ?? [];
    const find = (language: Locale): string | undefined => {
      // later layers win: a plugin can patch its own words
      for (const layer of [...layers].reverse()) {
        const hit = layer[language]?.[key];
        if (hit !== undefined) return hit;
      }
      return undefined;
    };
    const current = locale();
    return (
      find(current) ?? find("en") ?? find(current === "ru" ? "en" : "ru") ?? key
    );
  },
};
