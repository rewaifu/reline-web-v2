import { parse } from "sugar-high/core";
import * as json from "sugar-high/lang/json";

/** Token kinds the editor paints; every other kind (spaces, identifiers) stays
 * plain text. The colours live in `config-panel.module.scss`. */
const PAINTED: ReadonlySet<string> = new Set([
  "property",
  "string",
  "class",
  "keyword",
  "sign",
]);

const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};

const escapeText = (text: string): string =>
  text.replace(/[&<>]/gu, (char) => ESCAPES[char] ?? char);

/**
 * Pipeline JSON as HTML for the highlight layer under the editor's textarea.
 *
 * sugar-high's own renderer wraps every line and every token — spaces included
 * — in a span with an inline style: for a stack of a few hundred nodes that is
 * tens of thousands of elements. This one emits spans only for painted tokens,
 * leaves whitespace as text, and folds a whitespace run between two tokens of
 * one kind into the first (`": ["` is one span, not three), so the DOM is a
 * fraction of the size. The text content equals the input exactly, which is what
 * keeps the layer aligned with the textarea above it.
 */
export const highlightJson = (code: string): string =>
  parse(code, json)
    .lines.map((line) => {
      let html = "";
      let kind: string | undefined;
      let text = "";
      let gap = "";
      const flush = () => {
        if (kind !== undefined)
          html += `<span class="sh__token--${kind}">${escapeText(text)}</span>`;
        kind = undefined;
        text = "";
      };
      for (const token of line.tokens) {
        if (token.type === "space") {
          gap += token.value;
          continue;
        }
        if (!PAINTED.has(token.type)) {
          flush();
          html += escapeText(gap + token.value);
          gap = "";
          continue;
        }
        if (token.type === kind) text += gap + token.value;
        else {
          flush();
          html += escapeText(gap);
          kind = token.type;
          text = token.value;
        }
        gap = "";
      }
      flush();
      return html + escapeText(gap);
    })
    .join("\n");
