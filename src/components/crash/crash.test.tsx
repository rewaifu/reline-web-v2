import { cleanup, mount, tick } from "@rezejs/testing-library";
import type { Component } from "~/types/component";
import { signal } from "reze-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEY } from "~/constants";
import { setLocale } from "~/lib/i18n";
import { Errored } from "../errored/errored";
import { Crash, clearStoredNodes } from "./crash";

/** One throwing subtree must cost only itself: the error lands in the
 * fallback, the rest of the tree keeps reacting, and the screen offers the two
 * actions that actually recover — reload, or drop the saved tree and reload. */

const Boom: Component = () => {
  throw new Error("boom in a node form");
};

afterEach(cleanup);

describe("workspace error boundary", () => {
  beforeEach(() => setLocale("ru"));

  it("shows the failure and leaves the reactive system alive", () => {
    let count = signal(0);
    const view = mount(() => (
      <>
        <p id="outside">{String(count)}</p>
        <Errored fallback={(error) => <Crash error={error} />}>
          <Boom />
        </Errored>
      </>
    ));
    tick();

    // the failure is on screen, with the stack that makes it fixable
    const alert = view.el.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("Интерфейс сломался");
    expect(alert?.textContent).toContain("boom in a node form");

    // the point of the boundary: updates outside it still reach the DOM
    expect(view.el.querySelector("#outside")?.textContent).toBe("0");
    count = 1;
    tick();
    expect(view.el.querySelector("#outside")?.textContent).toBe("1");

    // recovery is offered, and it is not a button that cannot work: a reset
    // does not resurrect a component that threw on its own state
    const labels = [...view.el.querySelectorAll("button")].map((b) =>
      b.textContent?.trim(),
    );
    expect(labels).toEqual([
      "Перезагрузить страницу",
      "Сбросить ноды и перезагрузить",
    ]);
  });
});

describe("clearStoredNodes", () => {
  beforeEach(() => {
    setLocale("ru");
    // this runner's bare `localStorage` is Node's (and throws without
    // --localstorage-file), so the storage the app talks to is stubbed
    const entries = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => void entries.set(key, value),
      removeItem: (key: string) => void entries.delete(key),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("drops the saved tree and leaves everything else alone", () => {
    localStorage.setItem(STORAGE_KEY, '[{"uid":"a","type":"level"}]');
    localStorage.setItem("reline-web:runEndpoint", "ws://runner/run");

    clearStoredNodes();

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    // a crash screen must not take the run address or presets with it
    expect(localStorage.getItem("reline-web:runEndpoint")).toBe(
      "ws://runner/run",
    );
  });
});
