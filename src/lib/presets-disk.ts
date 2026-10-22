import * as v from "valibot";
import { raw, type LocalText } from "~/lib/i18n";
import { sanitizeNodes } from "~/lib/node-shape";
import { WsRequestError, wsHub } from "~/lib/ws";
import type { ConfigPreset } from "~/lib/presets";

/**
 * Presets on the runner's disk. The runner owns a folder (`RELINE_PRESETS_DIR`)
 * and the page reads and writes files in it by name, so a preset follows the
 * machine the work happens on, not the browser it was made in. One file per
 * preset, `<id>.json`, so two browsers saving different presets never write the
 * same file.
 */

/** What a preset file holds. `nodes` is checked node by node afterwards: a
 * file edited by hand may carry anything. */
const PresetFile = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  name: v.pipe(v.string(), v.minLength(1)),
  description: v.optional(v.string(), ""),
  nodes: v.array(v.unknown()),
});

const fileOf = (id: string): string => `${id}.json`;

/** The description a user preset is saved with — a dictionary key, so it reads
 * in the language of whoever looks. Anything else in a file is plain text. */
const USER_DESCRIPTION = "panel.presets.description.user";

const readDescription = (text: string): LocalText =>
  text === USER_DESCRIPTION ? USER_DESCRIPTION : raw(text);

const writeDescription = (description: LocalText): string =>
  typeof description === "string"
    ? description
    : "raw" in description
      ? description.raw
      : "";

export interface DiskList {
  /** The runner has a presets folder. */
  enabled: boolean;
  presets: ConfigPreset[];
  /** Files that are not presets (unreadable, wrong shape): left alone. */
  skipped: string[];
}

/** Read every preset file. Rejects when the runner cannot be reached or does not
 * know the method; a single bad file only lands in `skipped`. */
export const listDiskPresets = async (): Promise<DiskList> => {
  const list = v.parse(
    v.object({
      entries: v.array(v.string()),
      enabled: v.boolean(),
    }),
    await wsHub.call("config_list", {}),
  );
  if (!list.enabled) return { enabled: false, presets: [], skipped: [] };
  const presets: ConfigPreset[] = [];
  const skipped: string[] = [];
  await Promise.all(
    list.entries
      .filter((name) => name.endsWith(".json"))
      .map(async (name) => {
        try {
          const reply = v.parse(
            v.object({ content: v.string() }),
            await wsHub.call("config_read", { name }),
          );
          const file = v.parse(PresetFile, JSON.parse(reply.content));
          // the name on disk is the id's: a file renamed by hand is not trusted
          if (fileOf(file.id) !== name) throw new Error("id does not match");
          presets.push({
            id: file.id,
            name: file.name,
            description: readDescription(file.description),
            nodes: sanitizeNodes(file.nodes),
          });
        } catch {
          skipped.push(name);
        }
      }),
  );
  presets.sort((a, b) => a.id.localeCompare(b.id));
  return { enabled: true, presets, skipped: skipped.sort() };
};

export const writeDiskPreset = async (preset: ConfigPreset): Promise<void> => {
  await wsHub.call("config_write", {
    name: fileOf(preset.id),
    content: JSON.stringify({
      id: preset.id,
      name: preset.name,
      description: writeDescription(preset.description),
      nodes: preset.nodes,
    }),
  });
};

/** Remove a preset's file. A file that is already gone is the goal reached, not
 * a failure: the runner answers it with an error, and that is not retried. */
export const deleteDiskPreset = async (id: string): Promise<void> => {
  try {
    await wsHub.call("config_delete", { name: fileOf(id) });
  } catch (error) {
    if (error instanceof WsRequestError && error.kind === "remote") return;
    throw error;
  }
};
