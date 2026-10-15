import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UiSearchMenu } from "./search-menu";

// Positioning is the library's job and needs real layout: jsdom has none, and
// its zero-size boxes send autoUpdate into a loop. A fixed place is enough to
// test what the menu itself does.
vi.mock("@floating-ui/dom", () => ({
  computePosition: async () => ({ x: 0, y: 0 }),
  autoUpdate: () => () => {},
  flip: () => ({}),
  offset: () => ({}),
  shift: () => ({}),
  size: () => ({}),
}));

// jsdom has no layout, so no scrolling into view either
Element.prototype.scrollIntoView = () => {};

afterEach(cleanup);

const ITEMS = ["Folder Reader", "Upscale", "Sharp", "Folder Writer"];
const wait = () => {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, 30);
  return promise;
};

const setup = () => {
  const onPick = vi.fn();
  const view = mount(() => (
    <UiSearchMenu icon="plus" label="Add node" items={ITEMS} onPick={onPick} />
  ));
  const trigger = () =>
    view.el.querySelector<HTMLButtonElement>('button[aria-label="Add node"]')!;
  const field = () =>
    document.querySelector<HTMLInputElement>("input[role=combobox]");
  const options = () =>
    [...document.querySelectorAll("[role=option]")].map((o) => o.textContent);
  const open = async () => {
    fire(trigger(), "click");
    tick();
    await wait();
  };
  const type = (value: string) => {
    const input = field()!;
    input.value = value;
    fire(input, "input");
    tick();
  };
  const key = (name: string) => {
    fire(field()!, "keydown", { key: name });
    tick();
  };
  return { onPick, trigger, field, options, open, type, key };
};

describe("UiSearchMenu", () => {
  it("is a closed icon button until clicked", () => {
    const m = setup();
    expect(m.field()).toBeNull();
    expect(m.trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("moves focus into the search field as it opens, with every item listed", async () => {
    const m = setup();
    await m.open();
    expect(m.trigger().getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(m.field());
    expect(m.options()).toEqual(ITEMS);
  });

  it("filters by every typed word, in any order", async () => {
    const m = setup();
    await m.open();
    m.type("writer fol");
    expect(m.options()).toEqual(["Folder Writer"]);
    m.type("zzz");
    expect(m.options()).toEqual([]);
    expect(document.body.textContent).toContain("Nothing found");
  });

  it("Enter picks the highlighted item, arrows move it, and the menu closes", async () => {
    const m = setup();
    await m.open();
    // one key per task, as in a browser: a write is not visible before the flush
    m.key("ArrowDown");
    m.key("ArrowDown");
    m.key("Enter");
    expect(m.onPick).toHaveBeenCalledWith("Sharp");
    expect(m.field()).toBeNull();
    expect(document.activeElement).toBe(m.trigger());
  });

  it("a click picks, and Escape closes without picking", async () => {
    const m = setup();
    await m.open();
    fire(document.querySelectorAll("[role=option]")[1]!, "click");
    tick();
    expect(m.onPick).toHaveBeenCalledWith("Upscale");
    await m.open();
    m.key("Escape");
    expect(m.field()).toBeNull();
    expect(m.onPick).toHaveBeenCalledTimes(1);
  });

  it("starts from an empty search every time it opens", async () => {
    const m = setup();
    await m.open();
    m.type("sharp");
    m.key("Escape");
    await m.open();
    expect(m.field()!.value).toBe("");
    expect(m.options()).toEqual(ITEMS);
  });
});
