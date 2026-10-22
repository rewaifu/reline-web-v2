import { signal } from "reze-js";
import { storage } from "~/lib/storage";

/** The languages the UI ships. The type is deliberately narrow: every
 * dictionary is keyed by it, so a third language stays a type error until its
 * messages exist. */
export type Locale = "ru" | "en";

/** Language names in their own language: a switcher reading "Английский" is
 * useless to the person who needs English. */
export const LOCALE_NAMES: Record<Locale, string> = {
  ru: "Русский",
  en: "English",
};

const STORAGE_KEY = "reline-web:locale";

const stored = (): Locale | undefined => {
  // blocked storage (private mode) reads as nothing: detect per session
  const raw = storage.get(STORAGE_KEY);
  return raw === "ru" || raw === "en" ? raw : undefined;
};

/**
 * The first of the browser's languages (in the order the user ranked them) that
 * the UI ships. `["en-US", "ru"]` is English: the list is a preference order,
 * and asking "is Russian anywhere in it" made everyone who merely has Russian
 * installed get Russian. A list with nothing we ship (`["de"]`) is English, the
 * common fallback.
 */
export const detectLocale = (languages: readonly string[]): Locale => {
  for (const lang of languages) {
    const base = lang.toLowerCase().split(/[-_]/)[0];
    if (base === "ru" || base === "en") return base;
  }
  return "en";
};

/** Stored choice first, then the browser's languages. */
const initial = (): Locale => {
  const kept = stored();
  if (kept !== undefined) return kept;
  // no DOM (prerender, a test): the shell is Russian, the document default
  if (typeof navigator === "undefined") return "ru";
  return detectLocale(
    navigator.languages?.length ? navigator.languages : [navigator.language],
  );
};

let current = signal<Locale>(initial());

export const locale = (): Locale => current;

/** Switching costs one write and one signal set: every label in the app reads
 * `locale()` through `t()`, so nothing else has to be invalidated by hand. */
export const setLocale = (next: Locale): void => {
  current = next;
  // storage unavailable — the choice lives for this session
  storage.set(STORAGE_KEY, next);
};
