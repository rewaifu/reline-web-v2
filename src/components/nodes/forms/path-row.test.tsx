import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fire, mount, settle } from "@rezejs/testing-library";
import { signal } from "reze-js";

/** Reported: typing a folder name at the very start of a path field (no `/`
 * yet) showed no suggestions, while `./raws` or `raws/` did. The runner splits
 * the resolved path into directory and prefix; for a bare name the directory is
 * empty, and a build that does not fall back to "." lists nothing at all — a
 * silent empty answer, not an error. The field therefore asks for `./raws`,
 * which names the same folder on every build. */

interface LsSpy {
  (
    path: string,
    opts?: unknown,
  ): Promise<{ entries: string[]; dirs: string[] }>;
}

const ls = vi.fn<LsSpy>();

vi.mock("~/lib/ls-client", () => ({
  lsClient: { ls: (path: string, opts?: unknown) => ls(path, opts) },
}));

import { PathRow } from "~/components/nodes/forms/shared";

const FOLDER = ["raws", "raws_extra", "other"];

const Harness = () => {
  let value = signal("");
  return (
    <PathRow
      label="Path to folder"
      value={value}
      onInput={(next: string) => (value = next)}
      source="dirs"
    />
  );
};

const combobox = (el: HTMLElement) =>
  el.querySelector('[role="combobox"]') as HTMLInputElement;

const typeInto = (input: HTMLInputElement, text: string) => {
  input.value = text;
  fire(input, "input");
};

describe("path completion", () => {
  afterEach(cleanup);

  beforeEach(() => {
    ls.mockReset();
    ls.mockResolvedValue({
      entries: FOLDER.filter((name) => name.startsWith("raws")),
      dirs: FOLDER.filter((name) => name === "raws"),
    });
  });

  it("asks about a bare folder name", async () => {
    const view = mount(() => <Harness />);
    const input = combobox(view.el);
    typeInto(input, "raws");
    await vi.waitFor(() => expect(ls).toHaveBeenCalledWith("./raws", {}));
    // the field itself keeps what was typed — the `./` is a wire detail
    expect(input.value).toBe("raws");
  });

  it("leaves a value that already has a slash alone", async () => {
    const view = mount(() => <Harness />);
    typeInto(combobox(view.el), "/content/raw");
    await vi.waitFor(() => expect(ls).toHaveBeenCalledWith("/content/raw", {}));
  });

  it("opens the menu on a bare name and completes it with a slash", async () => {
    const view = mount(() => <Harness />);
    const input = combobox(view.el);
    typeInto(input, "raws");
    let list: Element | null = null;
    await vi.waitFor(() => {
      list = view.el.querySelector('[role="listbox"]');
      expect(list).not.toBeNull();
    });
    // `source="dirs"` keeps folders only — the file match must not appear
    expect((list as unknown as Element).textContent).toBe("raws/");
    fire(
      (list as unknown as Element).querySelector("button") as Element,
      "click",
    );
    await vi.waitFor(() => expect(input.value).toBe("raws/"));
  });

  it("asks with the folder in place once it is complete", async () => {
    const view = mount(() => <Harness />);
    typeInto(combobox(view.el), "raws/");
    await vi.waitFor(() => expect(ls).toHaveBeenCalledWith("raws/", {}));
  });

  it("lists the whole folder on focus, filters only once typing", async () => {
    const Seeded = () => {
      let value = signal("raws");
      return (
        <PathRow
          label="Path to folder"
          value={value}
          onInput={(next: string) => (value = next)}
          source="dirs"
        />
      );
    };
    const view = mount(() => <Seeded />);
    const input = combobox(view.el);
    fire(input, "focus");
    // the bare name is a prefix filter only while typing — entering the
    // field lists the whole current directory instead
    await vi.waitFor(() => expect(ls).toHaveBeenCalledWith("./", {}));
    await settle();
  });
});
