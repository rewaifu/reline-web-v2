import { describe, expect, it } from "vitest";
import { highlightJson } from "~/lib/highlight-json";

const textOf = (html: string) =>
  html
    .replace(/<[^>]+>/gu, "")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&amp;/gu, "&");

describe("highlightJson", () => {
  const sample = '{\n  "a": [1, true, null],\n\n  "b": "x<y>&z",\n  "c": {}\n}';

  it("keeps the text exactly: the layer must align with the textarea", () => {
    expect(textOf(highlightJson(sample))).toBe(sample);
    expect(textOf(highlightJson(""))).toBe("");
    expect(textOf(highlightJson("\n\n"))).toBe("\n\n");
  });

  it("escapes markup inside strings", () => {
    const html = highlightJson('{"a": "<b>&"}');
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;b&gt;&amp;");
  });

  it("paints keys, strings, numbers and keywords with token classes", () => {
    const html = highlightJson(sample);
    expect(html).toContain('<span class="sh__token--property">"a"</span>');
    expect(html).toMatch(/sh__token--string/u);
    expect(html).toMatch(/sh__token--class">1</u);
    expect(html).toMatch(/sh__token--keyword">true</u);
  });

  it("emits no inline styles, line wrappers or whitespace-only spans", () => {
    const html = highlightJson(sample);
    expect(html).not.toContain("style=");
    expect(html).not.toContain("sh__line");
    expect(html).not.toMatch(/<span[^>]*>\s+<\/span>/u);
  });

  it("folds whitespace between tokens of one kind into one span", () => {
    expect(highlightJson('{"a": [1]}')).toContain(">: [<");
  });
});
