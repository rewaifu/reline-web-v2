import * as v from "valibot";
import {
  MAX_MANIFEST_BYTES,
  PluginLoadError,
  fetchEntry,
  fetchManifest,
  fetchText,
  messageOf,
} from "./loader";
import { pluginStore } from "./store";

/**
 * Plugins shipped with a deployment — a desktop shell (Tauri), a company
 * build — instead of installed by each user.
 *
 * The deployer puts `plugins/bundled.json` beside the app (written by
 * `pnpm plugin:bundle`, `scripts/bundle-plugins.mjs`). At every start the host
 * installs what it lists, grants every capability the manifest asks for (the
 * deployer's consent replaces the consent card), refreshes a plugin whose
 * version or code changed, and removes one the list dropped. The user can still
 * switch a bundled plugin off; they cannot remove it, it would come back.
 *
 * A plugin the user installed under the same id by hand is left alone.
 */
const BundledListSchema = v.object({
  schema: v.literal(1),
  /** Manifest URLs, relative to the list file. */
  plugins: v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(500))),
});

/** Where the list lives, relative to the app. */
export const BUNDLED_LIST_PATH = "plugins/bundled.json";

export interface BundledFailure {
  detail: string;
}

/** The listed manifests. No file at all is a deployment without bundled
 * plugins, not an error. */
const readList = async (url: URL): Promise<string[]> => {
  let text: string;
  try {
    text = await fetchText(url, MAX_MANIFEST_BYTES);
  } catch (error) {
    if (error instanceof PluginLoadError && error.status === 404) return [];
    throw error;
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new PluginLoadError("manifest", `${url.href} is not JSON`);
  }
  const parsed = v.safeParse(BundledListSchema, json);
  if (!parsed.success) {
    const issue = parsed.issues[0];
    throw new PluginLoadError(
      "manifest",
      `${url.href}: ${issue.path?.map((p) => String(p.key)).join(".") ?? "list"}: ${issue.message}`,
    );
  }
  return parsed.output.plugins;
};

/** Bring the installed bundled plugins in line with the deployment. Never
 * throws: what could not be read comes back as failures for the Plugins tab,
 * and the rest of the plugins still start. Nothing runs here. */
export const syncBundled = async (): Promise<BundledFailure[]> => {
  const listUrl = new URL(
    `${import.meta.env.BASE_URL}${BUNDLED_LIST_PATH}`,
    window.location.href,
  );
  let sources: string[];
  try {
    sources = await readList(listUrl);
  } catch (error) {
    return [{ detail: messageOf(error) }];
  }
  const failures: BundledFailure[] = [];
  const listed = new Set<string>();
  for (const source of sources) {
    try {
      const candidate = await fetchManifest(
        new URL(source, listUrl).href,
        undefined,
        { shipped: true },
      );
      const { manifest } = candidate;
      listed.add(manifest.id);
      const existing = pluginStore.get(manifest.id);
      // the user's own install of the same id wins
      if (existing !== undefined && existing.bundled !== true) continue;
      if (
        existing !== undefined &&
        existing.manifest.version === manifest.version &&
        manifest.integrity !== undefined &&
        manifest.integrity === existing.integrity
      )
        continue;
      const { code, integrity } = await fetchEntry(candidate);
      const now = Date.now();
      pluginStore.put({
        manifest,
        manifestUrl: candidate.manifestUrl,
        entryUrl: candidate.entryUrl,
        integrity,
        grantedCaps: manifest.caps,
        // a plugin the user switched off, or the host did after a crash,
        // stays off through an update
        enabled: existing?.enabled ?? true,
        disabledReason: existing?.disabledReason,
        installedAt: existing?.installedAt ?? now,
        updatedAt: now,
        bundled: true,
      });
      pluginStore.cacheCode(manifest.id, code);
    } catch (error) {
      failures.push({ detail: messageOf(error) });
    }
  }
  // only a complete read may conclude that a plugin was dropped
  if (failures.length === 0)
    for (const plugin of pluginStore.list())
      if (plugin.bundled === true && !listed.has(plugin.manifest.id))
        pluginStore.remove(plugin.manifest.id);
  return failures;
};
