# Parity harness

Runs one scripted scenario against an origin and returns a JSON report. Diff reports from two origins to check behaviour parity (baseline Solid vs Reze).

Files:

- `scenario.mjs`: `export async function collect(page, origin, options?)`
- `diff.mjs`: `export function diffReports(a, b)` → `[{path, a, b}]`; `export function formatDiff(diffs)` → readable text

## Run from an omp eval cell

```js
const tab = browser.tab("parity");
const collectReport = async (origin) =>
  tab.run(
    async ({ page }) => {
      const { collect } =
        await import("/media/H/zed2/solid/reline_web/reline-web/scripts/parity/scenario.mjs");
      return collect(page, origin);
    },
    { timeout: 900 },
  );

const baseline = await collectReport("http://localhost:3001/");
const reze = await collectReport("http://localhost:3000/");

const { diffReports, formatDiff } =
  await import("/media/H/zed2/solid/reline_web/reline-web/scripts/parity/diff.mjs");
display(formatDiff(diffReports(baseline, reze)));
```

Use `localhost`, not `127.0.0.1`. One full pass takes about 36 s, so pass `timeout: 900`.

Determinism check: run `collectReport` twice on the same origin and compare `JSON.stringify` of both results. They must match.

## Sections

- `console`: every `warn`/`error` console message and `pageerror`, with the step that produced it.
- `load`: boot, document title, `lang`, viewport meta, icon links.
- `layout`: region boxes, page overflow, tab strip and burger, bottom switcher, per viewport (1400x900, 800x900, 390x844, 320x640, 844x390).
- `stack`: card count, per-card name/header/enabled/data-* attributes.
- `interactions`: outline open, add node, select, fold, rename, enable guard, swap menu, keyboard reorder, number edit with node identity, delete.
- `i18n`: Settings language flip ru↔en, label text both ways.
- `tabs`: every config-panel tab opens and shows its headline.
- `code`: export text, textarea vs highlight measurements, valid edit applies, invalid edit shows error.
- `presets`: apply the first preset.
- `persistence`: `reline-web:config` after debounce, reload restores the stack.
- `plugins`: empty state, catalog, no install without consent.

Origins are normalised to `<origin>` and UUIDs to `uid#N`, so reports from different hosts compare directly.
