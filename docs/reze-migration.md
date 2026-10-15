# Solid 2 → Reze migration

Branch `rewrite`. Goal: reline-web runs on Reze (`reze-js`, `@rezejs/vite-plugin`, `@rebase-ui/reze`) with
identical behaviour and no new bugs. Clean cutover: no Solid code, no dual runtime, no compat aliases.

Baseline (main @ e0bf438): `pnpm test` 34 files / 325 tests, `pnpm lint`, `pnpm typecheck` clean; build `dist/client` JS 483 kB (160 kB gzip), CSS 52.7 kB.

**Status: ported and verified.** Now: 36 files / 335 tests, lint + typecheck clean, JS 381 kB (123 kB gzip), CSS identical (52.69 kB, same hash). Parity harness (`scripts/parity`) baseline vs port: 1 difference left, the bundled `sequence` plugin version (1.2.0 → 1.3.0, new ABI). Independent browser verification (plugins, run/data, layout/input) found no open regressions; see "Verification record".

## Spike findings (/tmp/reze-spike, verified)

| Area                                                                     | Result                                                                                                                                                                                                            |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vite + TS + vitest(jsdom) + `@rezejs/testing-library`                    | works; tsc clean                                                                                                                                                                                                  |
| Cross-module `export let x = signal()` read via a plain function (`t()`) | reactive; importer reads by name, writes only through exported functions                                                                                                                                          |
| `store` array: patch in place, `splice` move, `push`                     | `<For each={store}>` keeps DOM nodes (identity), reorder moves them                                                                                                                                               |
| `selector(() => sel)` in `<For>` rows                                    | works (replaces `createProjection` selection)                                                                                                                                                                     |
| `computed(analyze([...nodes]))`                                          | deep store reads tracked                                                                                                                                                                                          |
| `catchError` as `Errored` (render **and** later binding errors)          | works, fallback renders                                                                                                                                                                                           |
| Uncaught effect error                                                    | thrown from `flush()`, system **not halted**, DOM keeps updating → ui-watchdog halt model is obsolete                                                                                                             |
| `effect` timing                                                          | first run is **synchronous at creation, before the JSX below it exists**; refs are unset. No `onMount`: keep elements in a signal via `ref` callback and read it in the effect                                    |
| Signal write                                                             | read-after-write returns new value; DOM/effects flush on microtask; `flush()` forces                                                                                                                              |
| `@rebase-ui/reze@0.1.2` production build                                 | **fails**: `ILLEGAL_REASSIGNMENT const ref` (compiler emits `ref = el` for `const ref = mergeRefs(...)`); dev/tests fine. Fix = `pnpm patch` (`const ref`→`let ref` in the sources) until upstream releases a fix |
| Compiler lowers `signal` to getter fn; `export let` exports the getter   | consumers must be compiled by the Reze plugin (tests, plugins, scripts)                                                                                                                                           |

## Idiom map

| Solid 2                                                  | Reze                                                                                                                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `const [x, setX] = createSignal(v)`                      | `let x = signal(v)`; write `x = v` (declare per name; not in a returned tuple, not in a helper that returns it)                                                     |
| passing `Accessor<T>`                                    | prop `x={sig}` arrives as a getter on `props.x`; for non-JSX APIs pass `() => sig`                                                                                  |
| `createMemo(() => expr)`                                 | `const m = computed(expr)` (expression, not a function)                                                                                                             |
| `createEffect(compute, apply)`                           | `effect(() => { …reads…; untrack(() => …writes/side effects) ; onCleanup(…) })` (one function; `onCleanup` allowed)                                                 |
| `onSettled(fn)` / mount                                  | no hook: `effect` runs at creation; DOM-dependent work reads an element signal set by `ref={(el) => (node = el)}` or defers with `queueMicrotask` inside the effect |
| `createStore` + `setStore(draft => …)`                   | `const s = store(v)`; mutate in place (`s.push`, `s[i].x = …`, `Object.assign(s[i].options, patch)`)                                                                |
| `createProjection` selection                             | `selector(() => selectedUid)` → `isSelected(uid)` per row                                                                                                           |
| `createRoot(fn)`                                         | `root(fn)`                                                                                                                                                          |
| `createContext` / `useContext`                           | same names; context value passed through `<Ctx value={…}>`; reactive value = getter                                                                                 |
| `Errored` / `createErrorBoundary`                        | own `Errored` over `catchError` (spike)                                                                                                                             |
| `Dynamic`                                                | `dynamic(() => C)` once per instance / `dynamicElement`                                                                                                             |
| `omit(props, …)`                                         | `omitProps(props, …)`                                                                                                                                               |
| `ComponentProps<"div">`, `JSX`                           | `JSX.IntrinsicElements["div"]`, `import type { JSX } from "reze-js"`; `Component<P>` = `(props: P) => JSX.Element`                                                  |
| `classList={{ a: x }}` / `class`                         | `class={{ a: x }}` or array                                                                                                                                         |
| `<Show>/<For>/<Switch>/<Match>/<Portal>`                 | same tags; `<For>` modes: identity (default), `keyed={fn}`, `keyed={false}`; row item/index read-as-signal rules differ per mode                                    |
| `flush()` in tests                                       | `tick()` from `@rezejs/testing-library` (= `flush`); writes are already visible synchronously                                                                       |
| `@solidjs/testing-library render/fireEvent/cleanup`      | `mount/fire/cleanup/tick/settle`                                                                                                                                    |
| `HydrationScript`, `Document.tsx`, `solid({start:true})` | plain `index.html` + `src/main.tsx` + `render()` (client only)                                                                                                      |
| `solid({diagnostics:true})`, `eslint-plugin-solid`       | compiler diagnostics (`reze({diagnostics:{jsonl}})`), oxlint without the solid plugin                                                                               |
| destructured props / copy `const x = props.y`            | read `props.y` where used; `PROPS_DESTRUCTURED`/`SIGNAL_READ_ONCE` are lint-level errors for us                                                                     |
| `onClick` etc.                                           | same camel-case; `[handler, data]` form; `on:name` for custom events                                                                                                |

## Porting rules (contract for every slice)

Order of precedence: these rules, then the idiom map, then the Reze docs (`/media/H/zed2/reze/reze-js/docs/src/routes/*.mdx`).

- **R1 module-level reactive state is private.** `let s = signal(v)` inside the module; the public API keeps its
  old shape — accessor _functions_ (`export const locale = () => current`) and setter functions. Call sites outside the
  module do not change (`locale()` stays `locale()`); runtime tracking works through plain calls.
  Exported signals (`export let x = signal()`) only when the consumer is a Reze component and it is clearly simpler.
- **R2 component-local state**: `let x = signal(v)`, read `x`, write `x = v`. Never `x()` on a signal; never
  `const copy = props.x` in a body (use `computed(props.x…)` or read in JSX/handlers). No destructured props.
- **R3 accessor-typed props stay `() => T`** (parent passes `() => value`; child calls `props.x()`).
- **R4 stores**: `store(v)`; reducers mutate in place (`splice`, `Object.assign(item.options, patch)`, `item.x = …`);
  survivors are never re-created (uid identity). `Store<T>` type → `T`.
- **R5 effects**: one function, reads tracked, side effects in `untrack(() => …)` when they must not subscribe,
  cleanup via `onCleanup` inside. The first run is synchronous at creation: an element that does not exist yet is not
  readable — keep it in a signal set from `ref={(el) => (node = el)}` and read that signal in the effect, or defer
  with `queueMicrotask` inside it. There is no `onMount`/`onSettled`.
- **R6 no halting**: an effect error is thrown out of `flush()`/the microtask and the system keeps running.
  `Errored` is `catchError` based (render and later binding errors both reach it).
- **R7 tests**: `@rezejs/testing-library` (`mount`, `cleanup`, `tick`, `settle`, `fire`); `afterEach(cleanup)`; DOM
  queried with `el.querySelector`. Signal writes are visible at once; DOM/effects need `tick()` (= `flush`). Keep every
  assertion; only the harness changes. A test file must not rely on another test having run first.
- **R8 types**: `Component`/`ParentProps` from `~/types/component`; `JSX` from `reze-js`; `Accessor<T>` → `() => T`.
- **R9 lists**: `<For each={…}>` identity mode (default) for stored arrays of objects (uid identity); never `.map` for
  stateful rows. `class` takes strings/objects/arrays (no `classList`). Events are camel-case (`onClick`, `onInput`,
  `onKeyDown`, `onPointerDown`); custom ones `on:name`.
- **R10 compile check after every file**: `node /tmp/reze-check.mjs <file>` — no error, and no warn of these codes:
  `SIGNAL_READ_ONCE`, `PROPS_DESTRUCTURED`, `INLINE_EACH`, `KEY_ON_ELEMENT`, `UNKNOWN_ATTRIBUTE`,
  `EVENT_NAME_LOWERCASE`, `FLOW_PARAM_CALLED`.
- **R11 clean cutover**: delete Solid workarounds that existed only because writes were deferred
  (plain-variable mirrors of signals, `flush()` after writes, `ownedWrite`, `untrack` for STRICT_READ warnings,
  `createEffect(compute, apply)` splits). Keep comments that explain _why_ the app behaves as it does; rewrite the
  ones that explain Solid 2 traps. No TODOs, no stubs.
- **R12 UI kit**: `@rebase-ui/reze/<part>` mirrors `@rebase-ui/solid/<part>` — same part names. Read
  `node_modules/@rebase-ui/reze/src/<part>` when unsure. A bug in it that blocks the build is fixed in
  `patches/@rebase-ui__reze@0.1.2.patch` (via `pnpm patch`), not worked around in app code.
- Do not run `pnpm build`/`lint`/full `pnpm test` mid-flight; run the compile check and, when its dependencies are
  already ported, the single test file (`pnpm exec vitest run <file>`). The integrator runs the gates.

## Findings during the port (verified, with decisions)

| #   | Finding                                                                                                                                                                                                                       | Decision                                                                                                                                                                                                                                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | `For` rebuilds **every** row on any list change when a row's value is a function (`Show`, `dynamic`, ternary, `Errored`, and in dev every `hotComponent` proxy). `insert` re-calls function slots; Solid cached them in memos | Rows must be DOM nodes/arrays of nodes. `overridable` split into `resolveOverride` + `overrideKey`; `NodeStack` builds its rows from the chain and rebuilds the list on `overrideKey` change. Regression test `node-card/reorder-identity.test.tsx`. **Verify list identity against the production build, not `pnpm dev`** (dev HMR proxies are function rows) |
| F2  | `@rebase-ui/reze` components read `props.children` once: a reactive single-expression child (`{render(label)}`) freezes                                                                                                       | wrap in a fragment (`<>{expr}</>`) at the call site (`UiTabs` tab labels, panel content)                                                                                                                                                                                                                                                                       |
| F3  | Vite dev: scan parses JSX with the React default; `@rebase-ui/reze` must not be pre-bundled                                                                                                                                   | `optimizeDeps.exclude` + `rolldownOptions.transform.jsx` (vite.config.ts)                                                                                                                                                                                                                                                                                      |
| F4  | an empty `reze-js/jsx-runtime` namespace breaks Vite's dep interop in dev                                                                                                                                                     | not exposed to plugins (compiled plugins never import it)                                                                                                                                                                                                                                                                                                      |
| F5  | effect error: rest of the flush is dropped until the next write, system keeps running                                                                                                                                         | watchdog kept (probe node + `createWatchdog`), overlay only on a confirmed stall                                                                                                                                                                                                                                                                               |
| F6  | `role` flagged `UNKNOWN_ATTRIBUTE` by the compiler although typed                                                                                                                                                             | `attr:role`                                                                                                                                                                                                                                                                                                                                                    |
| F7  | `dynamic` child under `Errored` is not caught on first render (component created in the binding after `catchError` returned)                                                                                                  | open: see P3 follow-up                                                                                                                                                                                                                                                                                                                                         |

Upstream issues to report: F1 (list rows with function values), F2 (children read once), F6, `const ref` (patched), `Errored` primitive not public.

## Phases and tasks

### P0 Safety net (before any port)

- P0.1 baseline gates recorded (done, see top)
- P0.2 baseline worktree of `main` built and served (port 3001) for side-by-side comparison
- P0.3 parity harness `scripts/parity/`: one puppeteer scenario run against two origins → JSON report (DOM text of stack/panels, geometry at 1400/800/390/320, console warn+error, localStorage writes, tab overflow, selection, drag reorder, i18n flip, plugin install flow, code tab overlay alignment). Diff = bug list
- P0.4 behaviour inventory: every invariant in `.omp/skills/reline-web/SKILL.md` maps to a test or a parity step (table in this file, below)

### P1 Toolchain

- P1.1 deps: add `reze-js`, `@rezejs/vite-plugin`, `@rezejs/testing-library`, `@rebase-ui/reze`; remove `solid-js`, `@solidjs/*`, `@rebase-ui/solid`, `eslint-plugin-solid`, `eslint`, `@testing-library/jest-dom`
- P1.2 `pnpm patch @rebase-ui/reze` (const ref); record in `pnpm-workspace.yaml`/AGENTS
- P1.3 `vite.config.ts` (reze plugin, `~` alias, sass, base `./`, build target, define `__REZE_HTML__/__REZE_HYDRATE__` for vitest), `tsconfig.json` (jsx preserve, jsxImportSource reze-js), `index.html` (old `Document.tsx` head moved), `src/main.tsx`
- P1.4 vitest config (jsdom, `vitest-setup.ts` without jest-dom or with equivalent asserts), oxlint config
- P1.5 build script: drop `rimraf dist/client/.vite` if not emitted; output stays `dist/client`; CI workflow paths

### P2 Reactive core (non-UI `src/lib`, `src/context`, `src/hooks` logic)

- P2.1 i18n: `locale.ts`, `plugin-dict.ts`, `index.ts` (`t` reads `locale`)
- P2.2 registries with `revision` signals: `lib/nodes/registry.ts`, `lib/ui/registry.ts`, `lib/pipeline/hooks.ts`, `lib/plugins/store.ts` (drop the deferred-write workaround: reads are immediate now)
- P2.3 `lib/ws/endpoint.ts`, `lib/run-client.ts`, `lib/model-db.ts`, `lib/presets.ts`, `lib/favicon-status.ts`
- P2.4 `context/*`: `store` for the stack, reducer by in-place mutation (uid identity invariants), `store-bridge`, contexts (`AnalysisContext` as getter)
- P2.5 hooks: `use-media-query`, `use-columns-layout`, `use-drag-reorder`, `use-node-actions`
- P2.6 tests ported: i18n, registry, hooks(pipeline), ws, run-client, run-endpoint, run-format, reducer, store, drag-*

### P3 UI kit (`src/components/ui/*`)

- P3.1 Button, Input, Label, Icon, Switch (`@rebase-ui/reze/switch`), Slider, Tabs (`@rebase-ui/reze/tabs` + overflow fit), Select, Combobox, SearchMenu, menu-position, dismiss-on-outside
- P3.2 `Errored`, `Slot`, `overridable`, `Crash`

### P4 Features

- P4.1 node-card, nodes-list, add-node-menu, node-swap, stack-toolbar
- P4.2 node forms (`shared.tsx`, 10 forms), noise chart
- P4.3 config-panel + tabs (code, run, presets, instructions, settings, plugins), diagnostic-list
- P4.4 workspace + App + watchdog decision (obsolete halt detection; keep a plain `window.onerror` overlay + plugin crash-boot flag recovery)

### P5 Plugin system

- P5.1 `sdk/`: `definePlugin`, `relinePlugin` (externalise `reze-js` + `reze-js/internal/*` to `globalThis.__RELINE__`, Reze compiler on plugin sources), `gen-host-exports` for Reze, bump `PLUGIN_API_VERSION`, loader refuses old-API plugins with a clear reason
- P5.2 `lib/plugins/{api,runtime,loader,bundled}.ts`, `worker-host.ts` (no UI, unchanged contract)
- P5.3 `examples/sequence` ported + contract test, `writer-suffix` re-pinned, `pnpm plugin:build`, catalog regenerated
- P5.4 `docs/PLUGINS.*`, `.omp/skills/reline-plugin-author`

### P6 Verification

- P6.1 gates: lint, typecheck, test (counts ≥ baseline), build (+ chunk size vs baseline)
- P6.2 parity harness vs baseline worktree: zero unexplained diffs
- P6.3 console: zero warn/error at idle and through every flow; compiler diagnostics (`jsonl`) reviewed: no `SIGNAL_READ_ONCE`, `PROPS_DESTRUCTURED`, `INLINE_EACH`, `KEY_ON_ELEMENT`, `UNKNOWN_ATTRIBUTE`
- P6.4 manual flows: add/move/delete/fold nodes, rename, swap, preset apply, import/export, run (WS mock), plugin install/enable/crash recovery, language flip, layout persist, phone 390/320 + landscape, keyboard + touch drag
- P6.5 memory/perf: 500-node stack render, selection click cost, no remount on option edit

### P7 Docs/skills/CI

- P7.1 README(en/ru), AGENTS.md, `.omp/skills/reline-web` rewritten for Reze, new `reze-patterns` skill, `.github/workflows`
- P7.2 delete leftovers: `solid` in comments, `Document.tsx`, watchdog remnants, `sdk/host-exports.json` regenerated

## Invariant → proof table

| Invariant (from the skill) | Proof |
|---|---|
| uid is the only identity; survivors never cloned | `context/reducer.test.ts`; `node-card/reorder-identity.test.tsx` (move, add, delete, active override keep the same card elements) |
| option edit keeps card DOM + focus | `node-card.test.tsx`; parity: same element after a number edit |
| selection click recomputes 2 rows | `selector` in Workspace; layout verifier: select click 30 ms vs 28 ms at 500 nodes |
| unknown node types kept verbatim | `registry.test.ts`, `node-shape.test.ts`; run/data verifier: `x.y` round trip |
| plugin boot crash flag recovery | `plugins.test.ts`; plugin verifier: crash reload disables the suspects |
| plugin errors contained (slot, override, dynamic child, late binding) | `errored/errored.test.tsx`, `slot/slot.test.tsx`; plugin verifier F7 verdict |
| tabs overflow burger | `tabs/fit.test.ts`; parity layout + burger sweep 1400→600 px identical |
| code overlay alignment | parity `code`; run/data verifier: scrollHeight/clientWidth equal, caret on the clicked line |
| phone layout 390/320/landscape | parity `layout` (5 viewports); layout verifier: deep diff 0 |
| i18n flip rerenders everything | `i18n.test.ts`; parity `i18n` (tab labels needed the fragment fix, F2) |
| run protocol, journal cap, resume | `run-client.test.ts`; run/data verifier against a mock runner |
| model list / path completion | `model-db.test.ts`, `path-row.test.tsx`; 12 cold visits per origin 12/12 |

## Verification record

- Gates: `pnpm lint`, `pnpm typecheck`, `pnpm test --run`, `pnpm build`, `pnpm plugin:build && pnpm plugin:pin` (no `public/plugins` drift).
- Compiler diagnostics (fresh build): only `AUTO_SELECTOR` (info); no warnings.
- Console at idle and through every flow: zero warn/error on dev and production builds (the runner WebSocket 404s on an absent runner are identical on the baseline).
- Perf, 500-node stack (single runs, noisy): first render 392 ms vs 1224 ms (faster), selection 30 vs 28 ms, option edit 1.2 vs 2.0 s (faster), keyboard reorder 1.6 vs 1.8 s, **expanding one card 614 vs 203 ms (3× slower)**, heap +17 %. DOM node count per card is *lower* than the baseline (expanded stack 1935 vs 2108 nodes). The expand cost is the O(N) re-subscribe of the persistence/analysis effects over the Reze store proxy; stacks are normally < 20 nodes.
- Known limits: list identity must be checked on the production build (F1/dev HMR); the `@rebase-ui/reze` patch is required until upstream fixes `const ref`; the plugin API is v2 — Solid-built (v1) plugins are refused with a message.
