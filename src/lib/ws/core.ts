import * as v from "valibot";
import { wsMethods } from "./methods";

/** The `ls` method (WS_API.md): list a directory of the runner's file system.
 * `root` is not sent — the deployment sets the base it browses. A reply that
 * leaves out a list is read as an empty one. */
export const LsReply = v.object({
  entries: v.optional(v.array(v.string()), []),
  dirs: v.optional(v.array(v.string()), []),
});

wsMethods.define({
  name: "ls",
  request: v.object({
    path: v.string(),
    ext: v.optional(v.array(v.string())),
    files_only: v.optional(v.boolean()),
  }),
  response: LsReply,
});

/** The `models` method: the runner's copy of the model database (the runner
 * fetches and keeps it, so whether the database is reachable is a property of
 * where the runner lives, not of the browser). Only `name` and `url` of each
 * entry are read; `stale` says the runner could not refresh and served an
 * older copy. */
export const ModelsReply = v.object({
  files: v.array(
    v.object({ name: v.string(), url: v.pipe(v.string(), v.url()) }),
  ),
  fetched_at: v.optional(v.number()),
  stale: v.optional(v.boolean(), false),
});

wsMethods.define({
  name: "models",
  request: v.object({ refresh: v.optional(v.boolean()) }),
  response: ModelsReply,
  // the runner may have to ask the database first (its own timeout is 15 s)
  timeoutMs: 25_000,
});

/** The preset files of the runner's disk (WS_API.md, `config_*`): the folder is
 * the deployment's (`RELINE_PRESETS_DIR`), the page only names files. `enabled`
 * says whether the runner has a folder at all — an old runner that does not
 * send it reads as "no". */
export const ConfigListReply = v.object({
  entries: v.optional(v.array(v.string()), []),
  enabled: v.optional(v.boolean(), false),
});

export const ConfigReadReply = v.object({
  name: v.string(),
  content: v.string(),
});

const fileName = v.pipe(v.string(), v.minLength(1));

wsMethods.define({
  name: "config_list",
  request: v.object({}),
  response: ConfigListReply,
});

wsMethods.define({
  name: "config_read",
  request: v.object({ name: fileName }),
  response: ConfigReadReply,
});

wsMethods.define({
  name: "config_write",
  request: v.object({ name: fileName, content: v.string() }),
  response: v.object({ name: v.string() }),
});

wsMethods.define({
  name: "config_delete",
  request: v.object({ name: fileName }),
  // the runner answers a bare `ok`: its payload is empty
  reply: "ok",
});
