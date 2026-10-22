import * as v from "valibot";

/**
 * What state the link to the runner is in — asked over plain HTTP, because a
 * WebSocket that fails to open says only "failed": it cannot tell a typo from a
 * tunnel that expired from a runner that crashed behind a healthy tunnel.
 *
 * The runner answers `GET /health` (the same host and prefix as its `/run`).
 * A tunnel in front of it that has nothing to forward to answers for itself,
 * and says which of its states this is in the `X-Krot-Link` header (and in the
 * status code, which is the fallback when the header is not readable):
 *
 * | answer                  | state        | meaning                                   |
 * | ----------------------- | ------------ | ----------------------------------------- |
 * | 200 + runner JSON       | `online`     | the runner is there                       |
 * | 404 / `unknown`         | `unknown`    | this link was never published             |
 * | 410 / `expired`         | `expired`    | the client vanished and did not return    |
 * | 410 / `closed`          | `closed`     | the client stopped publishing             |
 * | 503 / `offline`         | `offline`    | the client is away but may come back      |
 * | 502 / `unreachable`     | `unreachable`| the client dropped on this request        |
 * | 502 / `local-down`      | `localDown`  | tunnel up, the service behind it is not   |
 *
 * A page can read these only when the answer carries CORS headers; when it does
 * not, a request that fails outright is told apart from one that was answered
 * but cannot be read (`unverified`) with a second, opaque request.
 */
export const LINK_STATES = [
  "online",
  "unknown",
  "expired",
  "closed",
  "gone",
  "offline",
  "unreachable",
  "localDown",
  "noNetwork",
  "noAnswer",
  "notRunner",
  "unverified",
  "blocked",
  "badAddress",
] as const;

export type LinkState = (typeof LINK_STATES)[number];

/** States no amount of waiting fixes: the address is wrong, or the link is
 * gone for good. Retrying them is noise; the user has to change something. */
const FINAL: readonly LinkState[] = [
  "unknown",
  "expired",
  "closed",
  "gone",
  "blocked",
  "badAddress",
];
export const isFinalLinkState = (state: LinkState): boolean =>
  FINAL.includes(state);

export interface LinkReport {
  state: LinkState;
  /** The address that was asked, so a stale report is never shown for another. */
  url: string;
  /** HTTP status, when an answer was read. */
  status?: number;
  /** `Retry-After` of an `offline` answer, in seconds. */
  retryAfter?: number;
  /** Runner only: a run is in flight, and which. */
  busy?: boolean;
  runId?: string;
  at: number;
}

export type LinkProbe = (url: string) => Promise<LinkReport>;

const PROBE_TIMEOUT_MS = 8000;

/** The runner's `/health` body. Only what the UI reads is checked. */
const HealthSchema = v.object({
  ok: v.literal(true),
  busy: v.optional(v.boolean()),
  run_id: v.optional(v.nullable(v.string())),
});

const KROT_VERDICTS: Record<string, LinkState | undefined> = {
  unknown: "unknown",
  expired: "expired",
  closed: "closed",
  offline: "offline",
  unreachable: "unreachable",
  "local-down": "localDown",
};

const isLoopback = (host: string): boolean =>
  host === "localhost" ||
  host === "127.0.0.1" ||
  host === "[::1]" ||
  host.endsWith(".localhost");

/**
 * `ws://host:port/run` → `http://host:port/health`; `wss` → `https`. The runner
 * mounts `/run` and `/health` side by side, so the path's last segment is
 * swapped when it is `run` and a bare host gets `/health` at the root.
 * `undefined` for anything that is not a ws/http(s) address.
 */
export const healthUrl = (address: string): URL | undefined => {
  let parsed: URL;
  try {
    parsed = new URL(address.trim());
  } catch {
    return undefined;
  }
  const protocol: Record<string, string | undefined> = {
    "ws:": "http:",
    "wss:": "https:",
    "http:": "http:",
    "https:": "https:",
  };
  const next = protocol[parsed.protocol];
  if (next === undefined || parsed.host === "") return undefined;
  const base = parsed.pathname.replace(/\/+$/, "").replace(/\/run$/, "");
  return new URL(`${next}//${parsed.host}${base}/health`);
};

const statusState = (status: number): LinkState => {
  if (status === 404) return "notRunner";
  if (status === 410) return "gone";
  if (status === 503) return "offline";
  return "unreachable";
};

const retryAfterOf = (headers: Headers): number | undefined => {
  const seconds = Number(headers.get("retry-after"));
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
};

/** One `fetch`, abandoned after the timeout. */
const timed = async (
  url: URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

/** Ask the link what state it is in. Never rejects: every failure is a state. */
export const probeLink: LinkProbe = async (address) => {
  const url = healthUrl(address);
  const report = (
    state: LinkState,
    extra: Partial<LinkReport> = {},
  ): LinkReport => ({ state, url: address, at: Date.now(), ...extra });
  if (url === undefined) return report("badAddress");
  // an https page may not talk to a plain-http host (loopback is exempt): the
  // WebSocket would be refused the same way, and "no network" would mislead
  if (
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    url.protocol === "http:" &&
    !isLoopback(url.hostname)
  )
    return report("blocked");

  let response: Response;
  try {
    response = await timed(
      url,
      { cache: "no-store", credentials: "omit" },
      PROBE_TIMEOUT_MS,
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      return report("noAnswer");
    // refused, unreadable or unreachable: an opaque request tells the two
    // apart — it resolves when something answered, whatever it said
    try {
      await timed(
        url,
        { mode: "no-cors", cache: "no-store" },
        PROBE_TIMEOUT_MS,
      );
      return report("unverified");
    } catch {
      return report("noNetwork");
    }
  }

  const retryAfter = retryAfterOf(response.headers);
  const verdict =
    KROT_VERDICTS[
      (response.headers.get("x-krot-link") ?? "").trim().toLowerCase()
    ];
  if (verdict !== undefined)
    return report(verdict, { status: response.status, retryAfter });
  if (!response.ok)
    return report(statusState(response.status), {
      status: response.status,
      retryAfter,
    });
  try {
    const health = v.safeParse(HealthSchema, await response.json());
    if (!health.success)
      return report("notRunner", { status: response.status });
    return report("online", {
      status: response.status,
      busy: health.output.busy,
      runId: health.output.run_id ?? undefined,
    });
  } catch {
    return report("notRunner", { status: response.status });
  }
};
