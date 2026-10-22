import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  healthUrl,
  isFinalLinkState,
  probeLink,
  type LinkState,
} from "~/lib/link-probe";

const RUNNER = "wss://abc.tunnel.example/run";

let calls: Array<{ url: string; mode?: string }>;
let answer: (url: string, init: RequestInit) => Promise<Response>;

beforeEach(() => {
  calls = [];
  answer = async () => new Response("{}");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: URL | string, init: RequestInit = {}) => {
      calls.push({ url: String(input), mode: init.mode });
      return answer(String(input), init);
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const state = async (): Promise<LinkState> => (await probeLink(RUNNER)).state;
const reply = (
  status: number,
  headers: Record<string, string> = {},
  body = "",
) => new Response(body, { status, headers });

describe("healthUrl", () => {
  it("asks the runner's /health next to its /run, over the matching scheme", () => {
    expect(healthUrl("ws://127.0.0.1:8000/run")?.href).toBe(
      "http://127.0.0.1:8000/health",
    );
    expect(healthUrl("wss://abc.example/run")?.href).toBe(
      "https://abc.example/health",
    );
    expect(healthUrl("wss://abc.example/run/")?.href).toBe(
      "https://abc.example/health",
    );
    expect(healthUrl("wss://abc.example/runner/run?x=1")?.href).toBe(
      "https://abc.example/runner/health",
    );
    expect(healthUrl("https://abc.example")?.href).toBe(
      "https://abc.example/health",
    );
    expect(healthUrl(" wss://abc.example/run ")?.href).toBe(
      "https://abc.example/health",
    );
  });

  it("refuses what is not a ws/http address", () => {
    expect(healthUrl("")).toBeUndefined();
    expect(healthUrl("abc")).toBeUndefined();
    expect(healthUrl("ftp://abc.example/run")).toBeUndefined();
  });
});

describe("probeLink", () => {
  it("reads a runner's health: online, busy and which run", async () => {
    answer = async () =>
      reply(
        200,
        {},
        JSON.stringify({
          ok: true,
          busy: true,
          run_id: "r1",
          version: "0.2.0",
        }),
      );
    const report = await probeLink(RUNNER);
    expect(report).toMatchObject({
      state: "online",
      busy: true,
      runId: "r1",
      status: 200,
      url: RUNNER,
    });
    expect(calls[0]).toMatchObject({
      url: "https://abc.tunnel.example/health",
    });
  });

  it("a runner with no run in flight has no run id", async () => {
    answer = async () =>
      reply(200, {}, JSON.stringify({ ok: true, busy: false, run_id: null }));
    expect((await probeLink(RUNNER)).runId).toBeUndefined();
  });

  it.each([
    ["unknown", "unknown"],
    ["expired", "expired"],
    ["closed", "closed"],
    ["offline", "offline"],
    ["unreachable", "unreachable"],
    ["local-down", "localDown"],
  ] as const)("the tunnel says %s in X-Krot-Link", async (header, want) => {
    answer = async () => reply(502, { "X-Krot-Link": header });
    expect(await state()).toBe(want);
  });

  it("the header outranks the status code", async () => {
    answer = async () => reply(410, { "X-Krot-Link": "expired" });
    expect(await state()).toBe("expired");
    answer = async () => reply(410, { "X-Krot-Link": "closed" });
    expect(await state()).toBe("closed");
  });

  it("carries Retry-After of an offline answer", async () => {
    answer = async () =>
      reply(503, { "X-Krot-Link": "offline", "Retry-After": "30" });
    expect(await probeLink(RUNNER)).toMatchObject({
      state: "offline",
      retryAfter: 30,
    });
  });

  it("falls back to the status code when the header cannot be read", async () => {
    for (const [status, want] of [
      [404, "notRunner"],
      [410, "gone"],
      [503, "offline"],
      [502, "unreachable"],
      [500, "unreachable"],
    ] as const) {
      answer = async () => reply(status);
      expect(await state()).toBe(want);
    }
  });

  it("a 200 that is not the runner's health is not a runner", async () => {
    answer = async () => reply(200, {}, JSON.stringify({ hello: "world" }));
    expect(await state()).toBe("notRunner");
    answer = async () => reply(200, {}, "<html>welcome</html>");
    expect(await state()).toBe("notRunner");
  });

  it("an answer that cannot be read is told from one that never came", async () => {
    // CORS: the readable request fails, the opaque one proves something answered
    answer = async (_url, init) => {
      if (init.mode === "no-cors") return reply(200);
      throw new TypeError("Failed to fetch");
    };
    expect(await state()).toBe("unverified");
    expect(calls.map((c) => c.mode)).toEqual([undefined, "no-cors"]);

    // nothing answered at all: no network, a dead name, a refused connection
    answer = async () => {
      throw new TypeError("Failed to fetch");
    };
    expect(await state()).toBe("noNetwork");
  });

  it("gives up on a server that never answers", async () => {
    vi.useFakeTimers();
    answer = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      });
    const pending = probeLink(RUNNER);
    await vi.advanceTimersByTimeAsync(8000);
    expect((await pending).state).toBe("noAnswer");
    // and does not try the opaque request for a timeout
    expect(calls).toHaveLength(1);
  });

  it("refuses a bad address without asking anyone", async () => {
    expect((await probeLink("not an address")).state).toBe("badAddress");
    expect(calls).toHaveLength(0);
  });

  it("never rejects", async () => {
    answer = async () => {
      throw new Error("boom");
    };
    await expect(probeLink(RUNNER)).resolves.toMatchObject({
      state: "noNetwork",
    });
  });
});

describe("final states", () => {
  it("are the ones waiting cannot fix", () => {
    for (const s of [
      "unknown",
      "expired",
      "closed",
      "gone",
      "blocked",
      "badAddress",
    ] as const)
      expect(isFinalLinkState(s)).toBe(true);
    for (const s of [
      "online",
      "offline",
      "unreachable",
      "localDown",
      "noNetwork",
      "noAnswer",
      "unverified",
      "notRunner",
    ] as const)
      expect(isFinalLinkState(s)).toBe(false);
  });
});
