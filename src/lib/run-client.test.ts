import { decode, encode } from "notepack.io";
import { tick } from "@rezejs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, setLocale } from "~/lib/i18n";
import { createRunClient, type RunClient } from "~/lib/run-client";
import type { LinkProbe, LinkReport, LinkState } from "~/lib/link-probe";
import type { PureConfig } from "~/types/node";

/** Frames travel as JSON here.
 *
 * The real codec is exercised in `run-endpoint.test.ts` (and by the app in a
 * browser, where notepack resolves to its browser build). Under jsdom vitest
 * loads the Node build, whose `decode` mangles a plain `Uint8Array` — exactly
 * the type a browser socket hands over with `binaryType = "arraybuffer"` — so
 * using it here would test that quirk instead of this client's logic. */
vi.mock("notepack.io", () => ({
  encode: (value: unknown) => new TextEncoder().encode(JSON.stringify(value)),
  decode: (input: Uint8Array) =>
    JSON.parse(new TextDecoder().decode(input)) as unknown,
}));

/** Resuming is the behaviour of this file: a socket that dies mid-run must
 * not end the run, and must never repeat `start` — the job survives detached
 * on the server (WS_API.md), so the client asks `status` and `attach`es by
 * `run_id`. jsdom has no WebSocket, and a real one cannot be made to die on
 * demand — this stands in for it, records every frame the client sends, and
 * lets a test drop the pipe without a close handshake. */
interface Frame {
  m: string;
  id?: number;
  d?: Record<string, unknown>;
}

class FakeSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  /** Every socket ever dialled, oldest first — the reconnect count. */
  static readonly all: FakeSocket[] = [];

  readyState = FakeSocket.CONNECTING;
  binaryType = "";
  readonly sent: Frame[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((ev: { data: ArrayBuffer }) => void) | null = null;

  constructor(readonly url: string) {
    FakeSocket.all.push(this);
  }

  send(payload: Uint8Array): void {
    this.sent.push(decode(payload) as Frame);
  }

  close(): void {
    this.readyState = FakeSocket.CLOSED;
  }

  /** The server accepted the upgrade. */
  open(): void {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }

  /** The pipe died: a close event, no close frame. */
  drop(): void {
    this.readyState = FakeSocket.CLOSED;
    this.onclose?.();
  }

  /** One frame from the runner. A real socket with `binaryType = "arraybuffer"`
   * hands over an ArrayBuffer, so the fake does too — a Buffer would decode to
   * something else entirely (`new Uint8Array(buffer)` reinterprets it). */
  server(frame: Frame): void {
    const bytes = encode(frame);
    this.onmessage?.({
      data: bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer,
    });
  }

  methods(): string[] {
    return this.sent.map((frame) => frame.m);
  }

  static reset(): void {
    FakeSocket.all.length = 0;
  }
}

/** What the link says when the client asks — a test sets the verdict. The real
 * probe talks HTTP and is tested on its own (`link-probe.test.ts`). */
let verdict: LinkState = "offline";
const asked: string[] = [];
const probe: LinkProbe = async (url) => {
  asked.push(url);
  return { state: verdict, url, at: Date.now() } satisfies LinkReport;
};

const PIPELINE = { nodes: [], preprocess: [] } as unknown as PureConfig;

/** What the journal reads right now, rendered in the current language. */
const journal = (client: RunClient): string[] =>
  client.messages().map((message) => render(message.text));

const last = (): FakeSocket => FakeSocket.all[FakeSocket.all.length - 1];

/** Start a run and let the socket open, the way the panel does. The server
 * answers `accepted {run_id}`; every later frame carries the same id. */
const RUN_ID = "a1b2c3d4e5f6";
const startRun = (client: RunClient): FakeSocket => {
  client.start("ws://runner/run", PIPELINE);
  tick();
  const socket = last();
  socket.open();
  socket.server({ m: "accepted", id: 1, d: { run_id: RUN_ID } });
  tick();
  return socket;
};

beforeEach(() => {
  // jsdom reports an English browser, so the Russian journal below names its
  // own language instead of inheriting one
  setLocale("ru");
  FakeSocket.reset();
  verdict = "offline";
  asked.length = 0;
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", FakeSocket);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("run lifecycle", () => {
  it("sends the config and follows the server", () => {
    const client = createRunClient(probe);
    const socket = startRun(client);

    expect(client.phase()).toBe("running");
    expect(client.runId()).toBe(RUN_ID);
    expect(socket.methods()).toEqual(["start"]);
    expect(socket.sent[0]?.d).toEqual({ pipeline: PIPELINE });

    socket.server({
      m: "progress",
      id: 1,
      d: {
        percent: 40,
        phase: "preprocess",
        stage: "download",
        label: "4x_a",
        run_id: RUN_ID,
      },
    });
    tick();
    expect(client.progress()?.percent).toBe(40);
    expect(client.progress()?.phase).toBe("preprocess");

    // a phase the UI does not know keeps the numbers, drops the chip
    socket.server({
      m: "progress",
      id: 1,
      d: { percent: 55, phase: "nonsense", run_id: RUN_ID },
    });
    tick();
    expect(client.progress()?.percent).toBe(55);
    expect(client.progress()?.phase).toBeUndefined();

    socket.server({ m: "done", id: 1, d: { ok: true, run_id: RUN_ID } });
    tick();
    expect(client.phase()).toBe("idle");
    expect(client.runId()).toBeUndefined();
    expect(journal(client)).toContain("Готово");
  });
});
describe("reconnect", () => {
  it("asks status and attaches after a drop instead of repeating start", () => {
    const client = createRunClient(probe);
    const first = startRun(client);
    first.server({
      m: "progress",
      id: 1,
      d: { percent: 40, phase: "process", run_id: RUN_ID },
    });
    tick();

    first.drop();
    tick();
    // the run is not over: the bar keeps its value and the journal says why
    expect(client.phase()).toBe("recovering");
    expect(client.runId()).toBe(RUN_ID);
    expect(client.progress()?.percent).toBe(40);
    expect(journal(client).at(-1)).toBe("Переподключение, попытка 1…");
    expect(FakeSocket.all).toHaveLength(1);

    vi.advanceTimersByTime(1000);
    const second = last();
    expect(second).not.toBe(first);

    second.open();
    tick();
    // the fresh socket asks where the run stands — it never repeats `start`
    // (that would write the outputs twice and earn `worker busy` anyway)
    expect(client.phase()).toBe("recovering");
    expect(second.methods()).toEqual(["status"]);
    expect(second.sent[0]?.d).toEqual({ run_id: RUN_ID });

    second.server({
      m: "status",
      id: 2,
      d: {
        run_id: RUN_ID,
        status: "running",
        progress: { percent: 40, phase: "process", run_id: RUN_ID },
      },
    });
    tick();
    expect(second.methods()).toEqual(["status", "attach"]);
    expect(second.sent[1]?.d).toEqual({ run_id: RUN_ID });

    second.server({
      m: "attached",
      id: 3,
      d: { run_id: RUN_ID, status: "running" },
    });
    tick();
    expect(client.phase()).toBe("running");
    expect(journal(client)).toContain("Подключено к прогону, кадры идут");

    // the retry counter resets: the next drop gets a full set of attempts
    second.server({
      m: "progress",
      id: 1,
      d: { percent: 80, phase: "process", run_id: RUN_ID },
    });
    tick();
    expect(client.progress()?.percent).toBe(80);
    second.drop();
    tick();
    expect(journal(client).at(-1)).toBe("Переподключение, попытка 1…");
  });

  it("adopts the run_id from worker busy instead of arguing with the gate", () => {
    const client = createRunClient(probe);
    client.start("ws://runner/run", PIPELINE);
    tick();
    const first = last();
    first.open();
    tick();
    // the server never answered `accepted` but the run exists (our own drop
    // raced the accept): `worker busy` names it
    first.server({
      m: "error",
      id: 1,
      d: { message: "worker busy", run_id: RUN_ID },
    });
    tick();
    expect(client.runId()).toBe(RUN_ID);
    expect(first.methods()).toEqual(["start", "attach"]);
    expect(first.sent[1]?.d).toEqual({ run_id: RUN_ID });
  });

  it("ends the watch when the run finished while we were away", () => {
    const client = createRunClient(probe);
    const first = startRun(client);
    first.drop();
    tick();
    vi.advanceTimersByTime(1000);
    const second = last();
    second.open();
    tick();
    second.server({
      m: "status",
      id: 2,
      d: { run_id: RUN_ID, status: "done", result: { ok: true } },
    });
    tick();
    expect(client.phase()).toBe("idle");
    expect(client.runId()).toBeUndefined();
    expect(journal(client)).toContain("Готово");
    expect(second.methods()).toEqual(["status"]);
  });

  it("retries an address that never answered instead of going quiet", () => {
    const client = createRunClient(probe);
    // a typo, a wrong port, a runner that is down: the socket dies before the
    // upgrade, so `onopen` never ran. This used to end the run in silence —
    // no retry, no journal line, and the panel looking idle as if nothing had
    // been pressed.
    client.start("ws://dead/run", PIPELINE);
    tick();
    expect(client.phase()).toBe("connecting");
    expect(last().methods()).toEqual([]);

    // a second press while the dial is in flight must not start a second run
    client.start("ws://dead/run", PIPELINE);
    tick();
    expect(FakeSocket.all).toHaveLength(1);

    last().drop();
    tick();
    expect(client.phase()).toBe("connecting");
    expect(journal(client).at(-1)).toBe("Переподключение, попытка 1…");

    vi.advanceTimersByTime(1000);
    expect(FakeSocket.all).toHaveLength(2);
    last().drop();
    tick();
    expect(journal(client).at(-1)).toBe("Переподключение, попытка 2…");
  });

  it("gives up on a dial that never reached the runner within half a minute", async () => {
    const client = createRunClient(probe);
    client.start("ws://dead/run", PIPELINE);
    tick();
    for (let i = 0; i < 12 && client.phase() !== "idle"; i += 1) {
      last().drop();
      tick();
      await vi.advanceTimersByTimeAsync(10_000);
    }
    expect(client.phase()).toBe("idle");
    const line = journal(client).at(-1) ?? "";
    // one line, naming the address and what the link said
    expect(line).toContain("Не удалось подключиться");
    expect(line).toContain("ws://dead/run");
    expect(line).toContain("Раннер не на связи");
  });

  it("backs off 1 s, 2 s, 4 s, 8 s and then every 10 s", async () => {
    const client = createRunClient(probe);
    const first = startRun(client);
    first.drop();
    tick();

    vi.advanceTimersByTime(999);
    expect(FakeSocket.all).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.all).toHaveLength(2);

    for (const wait of [2000, 4000, 8000, 10_000, 10_000]) {
      last().drop();
      tick();
      await vi.advanceTimersByTimeAsync(wait - 1);
      const before = FakeSocket.all.length;
      await vi.advanceTimersByTimeAsync(1);
      expect(FakeSocket.all).toHaveLength(before + 1);
    }
  });

  it("keeps a followed run for ten minutes, then says what the link last said", async () => {
    const client = createRunClient(probe);
    startRun(client).drop();
    tick();

    let waited = 0;
    while (client.phase() !== "idle" && waited < 12 * 60_000) {
      await vi.advanceTimersByTimeAsync(10_000);
      waited += 10_000;
      if (client.phase() !== "idle") last().drop();
      tick();
    }
    // far beyond the old fifteen seconds, and not an hour of retries either
    expect(waited).toBeGreaterThan(9 * 60_000);
    expect(waited).toBeLessThanOrEqual(11 * 60_000);
    expect(client.phase()).toBe("idle");
    const line = journal(client).at(-1) ?? "";
    expect(line).toContain("Связь не восстановилась за 10 мин");
    expect(line).toContain("Раннер не на связи");
    expect(line).toContain("нажмите «Продолжить»");
  });

  it("asks the link only from the second failed attempt", async () => {
    const client = createRunClient(probe);
    startRun(client).drop();
    tick();
    await vi.advanceTimersByTimeAsync(1000);
    expect(asked).toEqual([]);
    last().drop();
    tick();
    await vi.advanceTimersByTimeAsync(2000);
    expect(asked).toEqual(["ws://runner/run"]);
  });

  it("writes a change of the link's state into the journal once", async () => {
    const client = createRunClient(probe);
    startRun(client).drop();
    tick();
    await vi.advanceTimersByTimeAsync(1000);
    for (let i = 0; i < 3; i += 1) {
      last().drop();
      tick();
      await vi.advanceTimersByTimeAsync(10_000);
    }
    const states = journal(client).filter((l) =>
      l.startsWith("Связь с раннером"),
    );
    expect(states).toEqual(["Связь с раннером: Раннер не на связи"]);

    verdict = "online";
    last().drop();
    tick();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(
      journal(client).filter((l) => l.startsWith("Связь с раннером")),
    ).toEqual([
      "Связь с раннером: Раннер не на связи",
      "Связь с раннером: Раннер на связи",
    ]);
  });

  it.each([
    ["unknown", "Ссылка не найдена"],
    ["expired", "Ссылка просрочена"],
    ["closed", "Ссылка закрыта"],
  ] as const)(
    "stops at once when the link says %s — waiting cannot fix it",
    async (state, label) => {
      verdict = state;
      const client = createRunClient(probe);
      startRun(client).drop();
      tick();
      await vi.advanceTimersByTimeAsync(1000);
      last().drop();
      tick();
      await vi.advanceTimersByTimeAsync(2000);

      expect(client.phase()).toBe("idle");
      const line = journal(client).at(-1) ?? "";
      expect(line).toContain(label);
      expect(line.startsWith("Прогон недоступен")).toBe(true);
      // and nothing dials again
      const dialled = FakeSocket.all.length;
      await vi.advanceTimersByTimeAsync(60_000);
      expect(FakeSocket.all).toHaveLength(dialled);
    },
  );

  it("treats a runner that is merely away as worth waiting for", async () => {
    for (const state of [
      "offline",
      "unreachable",
      "localDown",
      "noNetwork",
    ] as const) {
      FakeSocket.reset();
      verdict = state;
      const client = createRunClient(probe);
      startRun(client).drop();
      tick();
      await vi.advanceTimersByTimeAsync(1000);
      last().drop();
      tick();
      await vi.advanceTimersByTimeAsync(2000);
      expect(client.phase()).toBe("recovering");
      client.stop();
    }
  });

  it("redials a handshake that never finished instead of sitting in connecting", async () => {
    const client = createRunClient(probe);
    client.start("ws://slow/run", PIPELINE);
    tick();
    expect(FakeSocket.all).toHaveLength(1);
    // the TCP connection is up, the upgrade never completes
    await vi.advanceTimersByTimeAsync(12_000);
    expect(journal(client)).toContain("Сервер не ответил на подключение");
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeSocket.all).toHaveLength(2);
  });

  it("survives a quiet runner: no echo for 20 s is not a dead socket", async () => {
    const client = createRunClient(probe);
    startRun(client);
    await vi.advanceTimersByTimeAsync(40_000);
    tick();
    expect(client.phase()).toBe("running");
    expect(FakeSocket.all).toHaveLength(1);
  });

  it("drops a silent socket and dials instead of ending the run", () => {
    const client = createRunClient(probe);
    startRun(client);

    // no echo reply for 45 s: the watchdog fires, closes the socket, retries
    vi.advanceTimersByTime(50_000);
    tick();
    expect(client.phase()).toBe("recovering");
    expect(journal(client)).toContain(
      "Соединение потеряно: нет ответа на echo",
    );
  });

  it("does not retry a run the user stopped", () => {
    const client = createRunClient(probe);
    const socket = startRun(client);

    client.stop();
    tick();
    expect(client.phase()).toBe("stopping");
    expect(socket.methods()).toEqual(["start", "stop"]);
    expect(socket.sent[1]?.d).toEqual({ run_id: RUN_ID });

    socket.server({ m: "done", id: 2, d: { ok: false, cancelled: true } });
    tick();
    expect(client.phase()).toBe("idle");
    expect(journal(client)).toContain("Остановлено");

    vi.advanceTimersByTime(30_000);
    expect(FakeSocket.all).toHaveLength(1);
  });

  it("cancels a pending retry when the user stops", () => {
    const client = createRunClient(probe);
    startRun(client).drop();
    tick();
    expect(client.phase()).toBe("recovering");

    client.stop();
    tick();
    expect(client.phase()).toBe("idle");
    expect(journal(client)).toContain("Отменено до подключения");

    vi.advanceTimersByTime(30_000);
    expect(FakeSocket.all).toHaveLength(1);
  });
});
