// Behaviour-parity scenario. Runs one scripted pass against an origin and
// returns a JSON-serialisable report. Use via an omp `tab.run` cell:
//   const { collect } = await import("/abs/path/scripts/parity/scenario.mjs");
//   return collect(page, "http://localhost:3001/");
//
// Selectors use only roles, aria-labels, data-* attributes, visible text and
// structure. Every step returns {ok, details}; a thrown error is recorded as
// {ok:false, details:{error}} and the run continues.

const CONFIG_KEY = "reline-web:config";
const LAYOUT_KEY = "reline-web:layout:v2";
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

const VIEWPORTS = [
  { name: "1400x900", width: 1400, height: 900, isMobile: false, hasTouch: false },
  { name: "800x900", width: 800, height: 900, isMobile: false, hasTouch: false },
  { name: "390x844", width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: "320x640", width: 320, height: 640, isMobile: true, hasTouch: true },
  { name: "844x390", width: 844, height: 390, isMobile: true, hasTouch: true },
];

const CONFIG_TABS = ["Instructions", "Code", "Presets", "Run", "Settings", "Plugins"];

// Sleep never exceeds 600 ms.
const sleep = (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 600)));

// ---- page-side functions (self-contained: they are serialised into the page) ----

// Kobalte-compatible press: pointerdown + pointerup + click, or a plain click.
// Filters: sel, card (index into section[data-node-id]), any (aria-label or
// exact text), text, startsWith, firstLine, label, visible, index, mode.
const PRESS = (d) => {
  const root =
    d.card === undefined || d.card === null
      ? document
      : document.querySelectorAll("section[data-node-id]")[d.card];
  if (!root) return { found: false, reason: `no card ${d.card}` };
  let els = [...root.querySelectorAll(d.sel)];
  if (d.any !== undefined)
    els = els.filter((e) => e.getAttribute("aria-label") === d.any || e.textContent.trim() === d.any);
  if (d.text !== undefined) els = els.filter((e) => e.textContent.trim() === d.text);
  if (d.startsWith !== undefined) els = els.filter((e) => e.textContent.trim().startsWith(d.startsWith));
  if (d.firstLine !== undefined)
    els = els.filter((e) => (e.innerText || "").trim().split("\n")[0].trim() === d.firstLine);
  if (d.label !== undefined) els = els.filter((e) => e.getAttribute("aria-label") === d.label);
  if (d.labelStarts !== undefined)
    els = els.filter((e) => (e.getAttribute("aria-label") || "").startsWith(d.labelStarts));
  if (d.visible) els = els.filter((e) => e.getBoundingClientRect().width > 0);
  const el = els[d.index || 0];
  if (!el) return { found: false, matches: els.length };
  const r = el.getBoundingClientRect();
  const base = {
    bubbles: true,
    cancelable: true,
    composed: true,
    button: 0,
    pointerId: 1,
    isPrimary: true,
    pointerType: "mouse",
    clientX: r.x + r.width / 2,
    clientY: r.y + r.height / 2,
  };
  if (d.mode === "click") {
    el.dispatchEvent(new MouseEvent("click", { ...base, buttons: 0 }));
  } else {
    el.dispatchEvent(new PointerEvent("pointerdown", { ...base, buttons: 1 }));
    el.dispatchEvent(new PointerEvent("pointerup", { ...base, buttons: 0 }));
    el.dispatchEvent(new MouseEvent("click", { ...base, buttons: 0 }));
  }
  return { found: true, count: els.length, tag: el.tagName, label: el.getAttribute("aria-label") };
};

const READ_CARDS = () =>
  [...document.querySelectorAll("section[data-node-id]")].map((s) => {
    const sw = s.querySelector("[role=switch]");
    const label = sw ? sw.getAttribute("aria-label") || "" : "";
    const chev = s.querySelector('button[aria-label="Collapse node"],button[aria-label="Expand node"]');
    const dataAttrs = {};
    for (const a of s.attributes) if (a.name.startsWith("data-")) dataAttrs[a.name] = a.value;
    const head = s.firstElementChild;
    return {
      uid: s.getAttribute("data-node-id"),
      name: label.replace(/^Enable /, ""),
      header: head ? (head.textContent || "").replace(/\s+/g, " ").trim() : "",
      enabled: sw ? sw.getAttribute("aria-checked") : null,
      chevron: chev ? chev.getAttribute("aria-label") : null,
      bodyOpen: !!s.querySelector("[role=separator]"),
      dataAttrs,
    };
  });

const READ_TABPANEL = () => {
  const p = [...document.querySelectorAll("[role=tabpanel]")].find((x) => x.getBoundingClientRect().height > 0);
  if (!p) return null;
  return (p.innerText || "").replace(/\s+/g, " ").trim().slice(0, 400);
};

const READ_TABS = () =>
  [...document.querySelectorAll("[role=tab]")].map((t) => ({
    text: t.textContent.trim(),
    visible: t.getBoundingClientRect().width > 0,
    selected: t.getAttribute("aria-selected"),
  }));

const MEASURE = () => {
  const R = (e) => {
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const cards = [...document.querySelectorAll("section[data-node-id]")];
  const expandBtn = document.querySelector(
    'button[aria-label="Expand all nodes"],button[aria-label="Collapse all nodes"]',
  );
  let stack = null;
  let toolbar = null;
  if (expandBtn && cards[0]) {
    let e = expandBtn;
    while (e && !e.contains(cards[0])) e = e.parentElement;
    stack = e;
    let t = expandBtn;
    while (t && t.parentElement && t.parentElement !== stack) t = t.parentElement;
    toolbar = t;
  }
  const outline = document.querySelector("aside");
  const tablist = document.querySelector("[role=tablist]");
  let config = tablist;
  while (config && !config.querySelector("[role=tabpanel]")) config = config.parentElement;
  const switcher = document.querySelector("[role=group][aria-label]");
  const de = document.documentElement;
  const tabs = [...document.querySelectorAll("[role=tab]")].map((t) => ({
    text: t.textContent.trim(),
    visible: t.getBoundingClientRect().width > 0,
  }));
  const burger = document.querySelector('button[aria-label="More tabs"]');
  return {
    regions: { stack: R(stack), outline: R(outline), config: R(config), switcher: R(switcher) },
    toolbarText: toolbar ? (toolbar.innerText || "").replace(/\s+/g, " ").trim() : null,
    toolbarRect: R(toolbar),
    overflow: {
      scrollWidth: de.scrollWidth,
      clientWidth: de.clientWidth,
      scrollHeight: de.scrollHeight,
      clientHeight: de.clientHeight,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
    },
    tabStrip: {
      tabs,
      burgerVisible: !!burger && burger.getBoundingClientRect().width > 0,
    },
    switcherButtons: switcher
      ? [...switcher.querySelectorAll("button")].map((b) => ({
          label: b.getAttribute("aria-label"),
          title: b.title,
          pressed: b.getAttribute("aria-pressed"),
          visible: b.getBoundingClientRect().width > 0,
        }))
      : null,
    cardCount: cards.length,
  };
};

const CODE_VIEW = () => {
  const panel = [...document.querySelectorAll("[role=tabpanel]")].find((p) => p.getBoundingClientRect().height > 0);
  if (!panel) return null;
  const ta = panel.querySelector("textarea");
  const pre = panel.querySelector("pre");
  const errorLines = (panel.innerText || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /json|invalid|error|unexpected/i.test(l))
    .slice(0, 5);
  return {
    textarea: ta
      ? {
          scrollHeight: ta.scrollHeight,
          clientWidth: ta.clientWidth,
          value: ta.value,
          ariaInvalid: ta.getAttribute("aria-invalid"),
        }
      : null,
    pre: pre ? { scrollHeight: pre.scrollHeight, clientWidth: pre.clientWidth, text: pre.textContent } : null,
    alerts: [...panel.querySelectorAll("[role=alert]")].map((a) => a.textContent.trim()),
    errorLines,
  };
};

const SET_TEXTAREA = (value) => {
  const ta = document.querySelector("[role=tabpanel] textarea");
  if (!ta) return false;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
  setter.call(ta, value);
  ta.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
};

const READ_STORAGE = (key) => localStorage.getItem(key);
const LIST_STORAGE_KEYS = () => Object.keys(localStorage).sort();

// ---- node-side helpers ----

// Replaces every UUID with uid#N in first-appearance order (traversal order).
function normaliseUids(report, origin) {
  const map = new Map();
  const id = (u) => {
    const k = u.toLowerCase();
    if (!map.has(k)) map.set(k, `uid#${map.size + 1}`);
    return map.get(k);
  };
  const walk = (v) => {
    if (typeof v === "string") return v.split(origin).join("<origin>").replace(UUID_RE, id);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const o = {};
      for (const k of Object.keys(v)) o[k] = walk(v[k]);
      return o;
    }
    return v;
  };
  return walk(report);
}

const pressIn = (page, d) => page.evaluate(PRESS, d);

async function waitFor(page, fn, arg, timeoutMs) {
  try {
    await page.waitForFunction(fn, { timeout: timeoutMs, polling: 100 }, arg);
    return true;
  } catch {
    return false;
  }
}

async function waitReady(page, timeoutMs) {
  return waitFor(
    page,
    () => !!document.querySelector("[role=tablist]") && document.querySelectorAll("section[data-node-id]").length > 0,
    undefined,
    timeoutMs,
  );
}

// Opens a config-panel tab. Visible tabs are clicked directly; the rest go
// through the "More tabs" overflow listbox.
async function openTab(page, name) {
  const isSelected = () =>
    page.evaluate(
      (n) => [...document.querySelectorAll("[role=tab]")].find((t) => t.textContent.trim() === n)?.getAttribute("aria-selected") === "true",
      name,
    );
  await page.keyboard.press("Escape");
  await sleep(200);
  const visible = await page.evaluate((n) => {
    const t = [...document.querySelectorAll("[role=tab]")].find((x) => x.textContent.trim() === n);
    return !!t && t.getBoundingClientRect().width > 0;
  }, name);
  if (visible) {
    await pressIn(page, { sel: "[role=tab]", text: name, visible: true });
    await waitFor(page, (n) => [...document.querySelectorAll("[role=tab]")].find((t) => t.textContent.trim() === n)?.getAttribute("aria-selected") === "true", name, 2000);
    await sleep(300);
    if (await isSelected()) return { via: "tab", found: true };
  }
  await pressIn(page, { sel: "button", any: "More tabs" });
  await waitFor(page, (n) => [...document.querySelectorAll("[role=option]")].some((o) => o.textContent.trim() === n), name, 2000);
  const r = await pressIn(page, { sel: "[role=option]", text: name });
  await waitFor(page, (n) => [...document.querySelectorAll("[role=tab]")].find((t) => t.textContent.trim() === n)?.getAttribute("aria-selected") === "true", name, 2000);
  await sleep(300);
  return { via: "overflow", found: r.found && (await isSelected()) };
}

// ---- main ----

export async function collect(page, origin, options = {}) {
  const base = origin.replace(/\/$/, "") + "/";
  const waitMs = options.timeoutMs ?? 4000;
  const report = {
    console: [],
    load: {},
    layout: {},
    stack: {},
    interactions: {},
    i18n: {},
    tabs: {},
    code: {},
    presets: {},
    persistence: {},
    plugins: {},
  };

  let step = "boot";
  const onConsole = (msg) => {
    const t = msg.type();
    if (t !== "warning" && t !== "error") return;
    report.console.push({ type: t === "warning" ? "warn" : "error", text: msg.text(), step });
  };
  const onPageError = (err) => {
    report.console.push({ type: "pageerror", text: String(err && err.message ? err.message : err), step });
  };
  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  const run = async (section, name, fn) => {
    step = `${section}.${name}`;
    try {
      report[section][name] = await fn();
    } catch (e) {
      report[section][name] = { ok: false, details: { error: (e && e.message) || String(e) } };
    }
  };

  const reloadApp = async () => {
    await page.reload({ waitUntil: "load" });
    return waitReady(page, waitMs);
  };

  const setDesktop = () =>
    page.setViewport({ width: 1400, height: 900, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

  const cardsNow = () => page.evaluate(READ_CARDS);
  const uidsNow = async () => (await cardsNow()).map((c) => c.uid);
  const focusHandle = (uid) =>
    page.evaluate((u) => {
      const h = document.querySelector(`section[data-node-id="${u}"] [data-drag-handle]`);
      h?.focus();
      return !!h;
    }, uid);

  // ---- load ----
  await run("load", "boot", async () => {
    await page.goto(base, { waitUntil: "load" });
    await page.evaluate(() => localStorage.clear());
    await setDesktop();
    const ready = await reloadApp();
    return { ok: ready, details: { ready } };
  });

  await run("load", "document", async () => {
    const details = await page.evaluate(() => ({
      title: document.title,
      lang: document.documentElement.getAttribute("lang"),
      viewport: document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? null,
      icons: [...document.querySelectorAll('link[rel~="icon"]')].map((l) => ({
        rel: l.getAttribute("rel"),
        href: l.getAttribute("href"),
        type: l.getAttribute("type"),
        sizes: l.getAttribute("sizes"),
      })),
    }));
    return { ok: true, details };
  });

  // ---- layout ----
  for (const vp of VIEWPORTS) {
    await run("layout", vp.name, async () => {
      await page.setViewport({
        width: vp.width,
        height: vp.height,
        isMobile: vp.isMobile,
        hasTouch: vp.hasTouch,
        deviceScaleFactor: 1,
      });
      await page.evaluate((k) => localStorage.removeItem(k), LAYOUT_KEY);
      const ready = await reloadApp();
      await sleep(400);
      const m = await page.evaluate(MEASURE);
      return { ok: ready, details: m };
    });
  }
  await run("layout", "restore", async () => {
    await setDesktop();
    await page.evaluate((k) => localStorage.removeItem(k), LAYOUT_KEY);
    const ready = await reloadApp();
    return { ok: ready, details: { ready } };
  });

  // ---- stack (1400 default) ----
  await run("stack", "state", async () => {
    const cards = await cardsNow();
    const toolbar = await page.evaluate(MEASURE);
    return {
      ok: cards.length > 0,
      details: {
        count: cards.length,
        toolbarText: toolbar.toolbarText,
        cards,
        enabledCount: cards.filter((c) => c.enabled === "true").length,
      },
    };
  });

  // ---- interactions (desktop 1400) ----
  await run("interactions", "openNodesPanel", async () => {
    const pressed = await page.evaluate(() => document.querySelector('button[title="Nodes"]')?.getAttribute("aria-pressed") ?? null);
    if (pressed !== "true") {
      await pressIn(page, { sel: 'button[title="Nodes"]' });
      await sleep(400);
    }
    const w = await page.evaluate(() => Math.round(document.querySelector("aside")?.getBoundingClientRect().width ?? -1));
    return { ok: w > 0, details: { wasPressed: pressed, asideWidth: w } };
  });

  let addedUid = null;
  await run("interactions", "addNode", async () => {
    const before = (await cardsNow()).length;
    const opened = await pressIn(page, { sel: 'aside button[aria-label="Add node"]' });
    await waitFor(page, () => document.querySelectorAll("[role=option]").length > 0, undefined, waitMs);
    const options = await page.evaluate(() => [...document.querySelectorAll("[role=option]")].map((o) => o.textContent.trim()));
    const picked = await pressIn(page, { sel: "[role=option]", startsWith: "Level" });
    await sleep(500);
    const cards = await cardsNow();
    const last = cards.at(-1);
    addedUid = last ? last.uid : null;
    return {
      ok: picked.found && cards.length === before + 1 && !!last && last.name === "Level",
      details: { opened: opened.found, options, before, after: cards.length, lastName: last ? last.name : null },
    };
  });

  await run("interactions", "selectNode", async () => {
    const rows = await page.evaluate(() => document.querySelectorAll("aside [data-node-id]").length);
    const r = await pressIn(page, { sel: "aside [data-node-id]", index: 0 });
    await sleep(400);
    const headline = await page.evaluate(READ_TABPANEL);
    return { ok: r.found && rows > 0, details: { outlineRows: rows, instructionsPanel: headline } };
  });

  await run("interactions", "foldUnfold", async () => {
    const chevSel = 'button[aria-label="Collapse node"],button[aria-label="Expand node"]';
    const before = (await cardsNow())[0];
    await pressIn(page, { card: 0, sel: chevSel });
    await sleep(400);
    const mid = (await cardsNow())[0];
    await pressIn(page, { card: 0, sel: chevSel });
    await sleep(400);
    const after = (await cardsNow())[0];
    return {
      ok: before.bodyOpen !== mid.bodyOpen && after.bodyOpen === before.bodyOpen,
      details: { before: before.bodyOpen, mid: mid.bodyOpen, after: after.bodyOpen },
    };
  });

  await run("interactions", "rename", async () => {
    const original = (await cardsNow())[0].name;
    const renameInput = 'input[aria-label="Node name"]';
    const typeName = async (text) => {
      await pressIn(page, { card: 0, sel: 'button[aria-label="Rename node"]' });
      const focused = await waitFor(page, (s) => !!document.querySelector(s), renameInput, 2000);
      if (!focused) return false;
      await page.evaluate((s) => {
        const el = document.querySelector(s);
        el.focus();
        el.select();
      }, renameInput);
      await page.keyboard.type(text);
      await page.keyboard.press("Enter");
      await sleep(400);
      return true;
    };
    const ok1 = await typeName("Renamed");
    const mid = (await cardsNow())[0].name;
    const ok2 = await typeName(original);
    const restored = (await cardsNow())[0].name;
    return { ok: ok1 && ok2 && mid === "Renamed" && restored === original, details: { original, mid, restored } };
  });

  await run("interactions", "enableGuard", async () => {
    const initial = (await cardsNow()).map((c) => c.enabled);
    const n = initial.length;
    for (let i = 0; i < n - 1; i++) {
      await pressIn(page, { card: i, sel: "[role=switch]", index: 0 });
      await sleep(250);
    }
    const disabledExceptLast = (await cardsNow()).map((c) => c.enabled);
    await pressIn(page, { card: n - 1, sel: "[role=switch]", index: 0 });
    await sleep(300);
    const lastPressed = (await cardsNow()).map((c) => c.enabled);
    for (let i = 0; i < n - 1; i++) {
      await pressIn(page, { card: i, sel: "[role=switch]", index: 0 });
      await sleep(250);
    }
    const restored = (await cardsNow()).map((c) => c.enabled);
    const ok =
      initial.every((v) => v === "true") &&
      disabledExceptLast.slice(0, -1).every((v) => v === "false") &&
      lastPressed.at(-1) === "true" &&
      JSON.stringify(restored) === JSON.stringify(initial);
    return { ok, details: { initial, disabledExceptLast, lastPressed, restored } };
  });

  await run("interactions", "swapMenu", async () => {
    const before = (await cardsNow()).length;
    await pressIn(page, { card: 0, sel: 'button[aria-label^="Swap "]' });
    await sleep(400);
    const menu = await page.evaluate(() =>
      [...document.querySelectorAll('[role=listbox] [role=option],[role=menu] [role=menuitem],[role=dialog]')].map((e) =>
        e.textContent.trim().slice(0, 60),
      ),
    );
    await page.keyboard.press("Escape");
    await sleep(300);
    const after = (await cardsNow()).length;
    return { ok: before === after, details: { before, after, menu: menu.slice(0, 40) } };
  });

  await run("interactions", "reorderKeyboard", async () => {
    const before = await uidsNow();
    await focusHandle(before[0]);
    await page.keyboard.press("ArrowDown");
    await sleep(400);
    const moved = await uidsNow();
    await focusHandle(before[0]);
    await page.keyboard.press("ArrowUp");
    await sleep(400);
    const restored = await uidsNow();
    return {
      ok: moved[1] === before[0] && JSON.stringify(restored) === JSON.stringify(before),
      details: { beforeOrder: before, movedOrder: moved, restoredOrder: restored },
    };
  });

  await run("interactions", "numberAndIdentity", async () => {
    const cards = await cardsNow();
    const idx = cards.findIndex((c) => c.name === "Upscale");
    if (idx < 0) return { ok: false, details: { error: "no Upscale card" } };
    const uid = cards[idx].uid;
    const expandedByUs = !cards[idx].bodyOpen;
    if (expandedByUs) {
      await pressIn(page, { card: idx, sel: 'button[aria-label="Collapse node"],button[aria-label="Expand node"]' });
      await sleep(400);
    }
    await page.evaluate((i) => {
      const c = document.querySelectorAll("section[data-node-id]")[i];
      c.__parityTag = "upscale-card";
      window.__parityCard = c;
    }, idx);
    const readNum = (i) =>
      page.evaluate(
        (j) => document.querySelectorAll("section[data-node-id]")[j].querySelector("input[type=number]")?.value ?? null,
        i,
      );
    const typeNum = async (i, text) => {
      await page.evaluate((j) => {
        const el = document.querySelectorAll("section[data-node-id]")[j].querySelector("input[type=number]");
        el?.focus();
        el?.select();
      }, i);
      await page.keyboard.type(text);
      await page.keyboard.press("Tab");
      await sleep(300);
      return readNum(i);
    };
    const sameCard = () =>
      page.evaluate(() => {
        const c = window.__parityCard;
        return !!c && c.isConnected && c.__parityTag === "upscale-card";
      });

    const numberBefore = await readNum(idx);
    const clampedHigh = await typeNum(idx, "999999999");
    const clampedLow = await typeNum(idx, "-5");
    await pressIn(page, { card: idx, sel: 'button[aria-label^="Increase "]', index: 0 });
    await sleep(300);
    const stepUp = await readNum(idx);
    await pressIn(page, { card: idx, sel: 'button[aria-label^="Decrease "]', index: 0 });
    await sleep(300);
    const stepDown = await readNum(idx);
    const restored = numberBefore === null ? null : await typeNum(idx, numberBefore);
    const sameAfterEdit = await sameCard();

    await focusHandle(uid);
    await page.keyboard.press("ArrowDown");
    await sleep(400);
    const sameAfterReorder = await sameCard();
    const indexMoved = (await cardsNow()).findIndex((c) => c.uid === uid);
    await focusHandle(uid);
    await page.keyboard.press("ArrowUp");
    await sleep(400);
    const indexRestored = (await cardsNow()).findIndex((c) => c.uid === uid);
    await page.evaluate(() => {
      window.__parityCard = null;
    });
    if (expandedByUs) {
      await pressIn(page, { card: indexRestored, sel: 'button[aria-label="Collapse node"]' });
      await sleep(300);
    }

    const ok =
      numberBefore !== null &&
      Number(clampedLow) >= 0 &&
      clampedHigh !== null &&
      restored === numberBefore &&
      sameAfterEdit &&
      sameAfterReorder &&
      indexMoved !== indexRestored;
    return {
      ok,
      details: {
        index: idx,
        numberBefore,
        clampedHigh,
        clampedLow,
        stepUp,
        stepDown,
        restored,
        sameElementAfterEdit: sameAfterEdit,
        sameElementAfterReorder: sameAfterReorder,
        indexMoved,
        indexRestored,
      },
    };
  });

  await run("interactions", "deleteAdded", async () => {
    const cards = await cardsNow();
    const before = cards.length;
    const idx = cards.findIndex((c) => c.uid === addedUid);
    if (idx < 0) return { ok: false, details: { error: "added node uid not found", addedUid } };
    const removedName = cards[idx].name;
    await pressIn(page, { card: idx, sel: 'button[aria-label="Delete node"]' });
    await sleep(500);
    const after = await cardsNow();
    return {
      ok: after.length === before - 1 && !after.some((c) => c.uid === addedUid),
      details: { before, after: after.length, removedName },
    };
  });

  // ---- i18n (Settings via overflow, ru <-> en) ----
  const snapshotText = async () => ({
    panel: await page.evaluate(READ_TABPANEL),
    tabs: await page.evaluate(READ_TABS),
    toolbar: (await page.evaluate(MEASURE)).toolbarText,
  });

  await run("i18n", "english", async () => {
    const via = await openTab(page, "Settings");
    return { ok: via.found, details: { via: via.via, ...(await snapshotText()) } };
  });

  await run("i18n", "toRussian", async () => {
    await pressIn(page, { sel: '[role=tabpanel] button', text: "English" });
    await sleep(300);
    const picked = await pressIn(page, { sel: "[role=option]", text: "Русский" });
    await sleep(500);
    return { ok: picked.found, details: await snapshotText() };
  });

  await run("i18n", "toEnglish", async () => {
    await pressIn(page, { sel: '[role=tabpanel] button', text: "Русский" });
    await sleep(300);
    const picked = await pressIn(page, { sel: "[role=option]", text: "English" });
    await sleep(500);
    return { ok: picked.found, details: await snapshotText() };
  });

  // ---- tabs (every config-panel tab) ----
  for (const name of CONFIG_TABS) {
    await run("tabs", name, async () => {
      const via = await openTab(page, name);
      const selected = await page.evaluate(
        (n) => [...document.querySelectorAll("[role=tab]")].find((t) => t.textContent.trim() === n)?.getAttribute("aria-selected") ?? null,
        name,
      );
      const headline = await page.evaluate(READ_TABPANEL);
      return {
        ok: via.found && selected === "true",
        details: { via: via.via, selected, headline: headline && headline.slice(0, 200) },
      };
    });
  }

  // ---- code ----
  await openTab(page, "Code");
  await run("code", "exportMatches", async () => {
    const view = await page.evaluate(CODE_VIEW);
    const text = view && view.pre ? view.pre.text : null;
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    const cards = await cardsNow();
    const nodes = parsed && Array.isArray(parsed.nodes) ? parsed.nodes.length : null;
    return {
      ok: parsed !== null && text === JSON.stringify(parsed, null, 2) && nodes === cards.length,
      details: {
        text,
        nodes,
        cards: cards.length,
        pre: view && view.pre ? { scrollHeight: view.pre.scrollHeight, clientWidth: view.pre.clientWidth } : null,
      },
    };
  });

  let originalText = null;
  await run("code", "editMeasure", async () => {
    await pressIn(page, { sel: "button", any: "Edit code" });
    await sleep(400);
    const view = await page.evaluate(CODE_VIEW);
    originalText = view && view.textarea ? view.textarea.value : null;
    const pre = view && view.pre ? view.pre : null;
    const ta = view && view.textarea ? view.textarea : null;
    return {
      ok: !!ta,
      details: {
        textareaScrollHeight: ta ? ta.scrollHeight : null,
        preScrollHeight: pre ? pre.scrollHeight : null,
        textareaClientWidth: ta ? ta.clientWidth : null,
        preClientWidth: pre ? pre.clientWidth : null,
        heightsEqual: !!ta && !!pre && ta.scrollHeight === pre.scrollHeight,
        widthsEqual: !!ta && !!pre && ta.clientWidth === pre.clientWidth,
      },
    };
  });

  await run("code", "applyValid", async () => {
    const parsed = JSON.parse(originalText);
    const trimmed = JSON.stringify({ ...parsed, nodes: parsed.nodes.slice(0, -1) }, null, 2);
    const before = (await cardsNow()).length;
    await page.evaluate(SET_TEXTAREA, trimmed);
    await pressIn(page, { sel: "button", any: "Apply edit" });
    await sleep(500);
    const afterApply = (await cardsNow()).length;
    await pressIn(page, { sel: "button", any: "Edit code" });
    await sleep(300);
    await page.evaluate(SET_TEXTAREA, originalText);
    await pressIn(page, { sel: "button", any: "Apply edit" });
    await sleep(500);
    const restored = (await cardsNow()).length;
    return { ok: afterApply === before - 1 && restored === before, details: { before, afterApply, restored } };
  });

  await run("code", "applyInvalid", async () => {
    const before = (await cardsNow()).length;
    await pressIn(page, { sel: "button", any: "Edit code" });
    await sleep(300);
    await page.evaluate(SET_TEXTAREA, "{");
    await pressIn(page, { sel: "button", any: "Apply edit" });
    await sleep(500);
    const view = await page.evaluate(CODE_VIEW);
    const after = (await cardsNow()).length;
    await pressIn(page, { sel: "button", any: "Discard edit" });
    await sleep(300);
    return {
      ok: after === before,
      details: {
        before,
        after,
        textareaOpen: !!(view && view.textarea),
        ariaInvalid: view && view.textarea ? view.textarea.ariaInvalid : null,
        alerts: view ? view.alerts : [],
        errorLines: view ? view.errorLines : [],
      },
    };
  });

  // ---- presets ----
  await openTab(page, "Presets");
  await run("presets", "applyFirst", async () => {
    const r = await pressIn(page, { sel: "[role=tabpanel] button", firstLine: "Default" });
    await sleep(500);
    const cards = await cardsNow();
    return {
      ok: r.found,
      details: { pressed: r, count: cards.length, types: cards.map((c) => c.name) },
    };
  });

  // ---- persistence ----
  await run("persistence", "stored", async () => {
    await waitFor(page, (k) => localStorage.getItem(k) !== null, CONFIG_KEY, waitMs);
    await sleep(550);
    const raw = await page.evaluate(READ_STORAGE, CONFIG_KEY);
    const cards = await cardsNow();
    return {
      ok: raw !== null,
      details: { raw: raw === null ? null : JSON.parse(raw), cards: cards.map((c) => c.name) },
    };
  });

  await run("persistence", "reload", async () => {
    const rawBefore = await page.evaluate(READ_STORAGE, CONFIG_KEY);
    const beforeCards = (await cardsNow()).map((c) => c.name);
    const ready = await reloadApp();
    await sleep(400);
    const afterCards = (await cardsNow()).map((c) => c.name);
    const rawAfter = await page.evaluate(READ_STORAGE, CONFIG_KEY);
    return {
      ok: ready && JSON.stringify(beforeCards) === JSON.stringify(afterCards),
      details: { ready, beforeCards, afterCards, storageUnchanged: rawBefore === rawAfter },
    };
  });

  // ---- plugins ----
  await run("plugins", "emptyState", async () => {
    const via = await openTab(page, "Plugins");
    await sleep(300);
    const panel = await page.evaluate(READ_TABPANEL);
    const rows = await page.evaluate(() => document.querySelectorAll("li[data-state]").length);
    return { ok: via.found, details: { via: via.via, panel, rows } };
  });

  await run("plugins", "catalog", async () => {
    const r = await pressIn(page, { sel: "button", any: "Verified plugins" });
    await sleep(500);
    const panel = await page.evaluate(READ_TABPANEL);
    const rows = await page.evaluate(() => document.querySelectorAll("li[data-state]").length);
    const inputs = await page.evaluate(() =>
      [...document.querySelectorAll("[role=tabpanel] input")].map((i) => i.placeholder || i.type),
    );
    return { ok: r.found, details: { panel, rows, inputs } };
  });

  await run("plugins", "noInstallWithoutConsent", async () => {
    const keys = await page.evaluate(LIST_STORAGE_KEYS);
    const pluginKeys = keys.filter((k) => /plugin/i.test(k));
    const stored = {};
    for (const k of pluginKeys) stored[k] = await page.evaluate(READ_STORAGE, k);
    const rows = await page.evaluate(() => document.querySelectorAll("li[data-state]").length);
    return { ok: rows === 0, details: { storageKeys: keys, pluginStorage: stored, installedRows: rows } };
  });

  await setDesktop();
  page.off("console", onConsole);
  page.off("pageerror", onPageError);

  return normaliseUids(report, origin.replace(/\/$/, ""));
}
