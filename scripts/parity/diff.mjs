// Deep diff of two JSON-serialisable parity reports.

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function typeOf(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

function walk(a, b, path, out) {
  const ta = typeOf(a);
  const tb = typeOf(b);
  if (ta !== tb) {
    out.push({ path, a, b });
    return;
  }
  if (ta === "array") {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const p = `${path}[${i}]`;
      if (i >= a.length) out.push({ path: p, a: undefined, b: b[i] });
      else if (i >= b.length) out.push({ path: p, a: a[i], b: undefined });
      else walk(a[i], b[i], p, out);
    }
    return;
  }
  if (ta === "object") {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    for (const k of keys) {
      const p = path === "" ? k : `${path}.${k}`;
      if (!(k in a)) out.push({ path: p, a: undefined, b: b[k] });
      else if (!(k in b)) out.push({ path: p, a: a[k], b: undefined });
      else walk(a[k], b[k], p, out);
    }
    return;
  }
  if (a !== b) out.push({ path, a, b });
}

/**
 * Returns [{path, a, b}] for every leaf that differs. `undefined` marks a
 * key/element present on only one side. Returns [] for equal reports.
 */
export function diffReports(a, b) {
  const out = [];
  walk(a, b, "", out);
  return out;
}

function show(v) {
  if (v === undefined) return "<missing>";
  let s = JSON.stringify(v);
  if (s === undefined) s = String(v);
  return s.length > 160 ? `${s.slice(0, 157)}...` : s;
}

/** Human-readable multi-line rendering of diffReports output. */
export function formatDiff(diffs) {
  if (!diffs.length) return "no differences";
  const lines = [`${diffs.length} difference(s):`];
  for (const d of diffs) {
    lines.push(`- ${d.path || "<root>"}`);
    lines.push(`    a: ${show(d.a)}`);
    lines.push(`    b: ${show(d.b)}`);
  }
  return lines.join("\n");
}
