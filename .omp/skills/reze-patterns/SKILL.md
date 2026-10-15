---
name: reze-patterns
description: >
  Reze (reze-js 0.1 + @rezejs/vite-plugin + @rebase-ui/reze) idioms and the traps this repo hit.
  Use when writing or reviewing any `.tsx`/reactive `.ts` in reline-web: signals, computed, store,
  effects, lists, refs, children, library components, tests, dev-vs-prod differences.
---

# Reze in reline-web

Docs: `docs/src/routes/*.mdx` in the reze-js repo (reactivity, components, lifecycle, building-interfaces,
familiar-patterns, compiler). Compile check for one file (prints diagnostics):
`node -e` over `@rezejs/compiler`'s `compile(source, file, {target:"client", moduleId:file})`, or just run
`pnpm dev` with `diagnostics.jsonl` (see vite.config.ts → `node_modules/.cache/reze-diagnostics.jsonl`).
The migration record is `docs/reze-migration.md` (findings F1–F7).

## Reactive primitives

- `let x = signal(v)` — read `x`, write `x = v` / `x += 1`. A write is visible at once; DOM and effects flush on a
  microtask (`flush()` / `tick()` in tests forces it). Declarations only: not in a returned tuple, not in a helper
  that returns the signal.
- `const m = computed(expr)` — the expression, not a function. Lazy, cached.
- `const s = store(obj)` — deep proxy; mutate in place (`push`, `splice`, `a.b = c`, `Object.assign(item.options, p)`).
  A `Map`/`Date`/class instance inside is not tracked (`trigger(() => …)`).
- `effect(() => { … })` — one function, tracked reads, `onCleanup` inside, `untrack(() => …)` for what must not
  subscribe. **The first run is synchronous at creation, before the JSX below it exists.** There is no
  `onMount`/`onSettled`: keep an element in a signal via `ref={(el) => (node = el)}` and read it in the effect, or
  defer with `queueMicrotask` inside it.
- `selector(() => key)` → `isSelected(k)` — one subscription per row (O(1) per click). Never compare the selected
  key inside every row.
- A compound write (`x += 1`) reads `x`: inside an effect it subscribes. For counters used as change signals use a
  plain variable (`revision = ++version`).
- Errors: `catchError(fn, handler)`; our `Errored` (`components/errored`) is built on it. An uncaught effect error is
  thrown out of `flush()`, the rest of that flush is **dropped** (bindings after the throwing effect stay stale)
  until the next write, and the system keeps running. Keep effect bodies safe anyway; the watchdog
  (`lib/ui-watchdog.ts`) catches a stuck DOM.

## Module state and APIs

- Module-level reactive state is private to its module: `let current = signal(v)`; the public API is accessor
  functions (`locale()`) and setters (`setLocale()`), so call sites read the same inside and outside Reze code and
  tracking works through plain calls. Prop accessors are `() => T`.
- `export let x = signal()` is allowed (importers read by name, cannot write) — prefer the accessor form here.
- Never hoist `t(...)` into a constant (freezes the language).

## Components, props, children

- A component runs once; reads in JSX/handlers are live, reads in the body are one-shot (`SIGNAL_READ_ONCE`).
  Never destructure props (`PROPS_DESTRUCTURED`); read `props.x` where used. `splitProps(props, ["a", "b"])`
  (typed) for `rest`; `omitProps`/`mergeProps` return an untyped `Props`.
- Types: `Component`/`ParentProps` from `~/types/component`; `JSX`, `PropsOf<"button">` from `reze-js`.
- `class` takes a string, object or array. `attr:role` for `role` (the compiler flags plain `role` as unknown, F6).
  Events are camel-case; `on:name` for custom ones; `[handler, data]` passes data.
- **`@rebase-ui/reze` components read `props.children` once.** A reactive single-expression child freezes — wrap
  it: `<Tabs.Tab><>{render(label)}</></Tabs.Tab>` (F2). Static children are fine.
- `dynamic(() => C)` once per instance (a component body or module scope); `dynamicElement` for runtime tags.

## Lists (F1 — the costly one)

`<For each={…}>` keeps a row while its item stays (identity mode; `keyed={fn}` / `keyed={false}` change what the row
params are: signals or plain). **A row whose value is a function rebuilds every row on any change of the list**:
`Show`, `dynamic`, a ternary/`&&`, `Errored`, and — in `pnpm dev` only — every component wrapped for HMR. Rows must
be DOM nodes or arrays of nodes (a fragment of elements is fine). Reactive parts go _inside_ an element. A host
component that must be overridable at row level uses `resolveOverride` + `overrideKey` and rebuilds the list on
the key (`NodeStack`). **List/DOM-identity checks run against the production build** (`pnpm build && pnpm serve`).

## Library (`@rebase-ui/reze`)

Sources hold compiler syntax: `optimizeDeps.exclude` in vite.config.ts, the Reze plugin compiles them
(`analyze: ["@rebase-ui/reze"]`). `patches/@rebase-ui__reze@0.1.2.patch` fixes `const ref` (compiler emits
`ref = el`). Parts mirror `@rebase-ui/solid`; read `node_modules/@rebase-ui/reze/src/<part>`.

## Tests

`@rezejs/testing-library`: `mount(() => <X/>)` → `{el, dispose}`, `afterEach(cleanup)`, `tick()`, `settle()`,
`fire(el, "click")` (for `key` etc. dispatch `new KeyboardEvent`). Query with `el.querySelector`. Test files are
compiled by the Reze plugin, so signals/`computed` work in them. jsdom: no Web Animations, no layout.

## Checklist before "done"

`pnpm lint && pnpm typecheck && pnpm test --run && pnpm build`; compiler diagnostics clean (no `SIGNAL_READ_ONCE`,
`PROPS_DESTRUCTURED`, `INLINE_EACH`, `KEY_ON_ELEMENT`, `UNKNOWN_ATTRIBUTE`, `FLOW_PARAM_CALLED`); UI changes
verified in the browser on the production build.
