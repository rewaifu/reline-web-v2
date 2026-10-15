import { afterEach, describe, expect, it } from "vitest";
import { cleanup, mount, settle, tick } from "@rezejs/testing-library";
import { dynamic, Show, signal, type JSX } from "reze-js";
import { Errored } from "~/components/errored/errored";

afterEach(cleanup);

const Boom = (): JSX.Element => {
  throw new Error("boom");
};
const Fine = () => <b>fine</b>;

const message = (error: () => unknown) => (
  <p>caught {(error() as Error).message}</p>
);

describe("Errored", () => {
  it("catches a component that throws while rendering", () => {
    const view = mount(() => (
      <Errored fallback={message}>
        <Boom />
      </Errored>
    ));
    expect(view.el.textContent).toBe("caught boom");
  });

  it("catches a dynamic child that throws on its first render", async () => {
    const Dyn = dynamic(() => Boom);
    const view = mount(() => (
      <Errored fallback={message}>
        <Dyn />
      </Errored>
    ));
    await settle();
    expect(view.el.textContent).toBe("caught boom");
  });

  it("catches a Show branch that throws when it opens", async () => {
    let open = signal(false);
    const view = mount(() => (
      <Errored fallback={message}>
        <i>ok</i>
        <Show when={open}>
          <Boom />
        </Show>
      </Errored>
    ));
    expect(view.el.textContent).toBe("ok");
    open = true;
    tick();
    await settle();
    expect(view.el.textContent).toBe("caught boom");
  });

  it("catches a binding that throws on a later update", async () => {
    let level = signal(0);
    const risky = () => {
      if (level > 0) throw new Error("late");
      return "fine";
    };
    const view = mount(() => (
      <Errored fallback={message}>
        <b>{risky()}</b>
      </Errored>
    ));
    expect(view.el.textContent).toBe("fine");
    level = 1;
    tick();
    await settle();
    expect(view.el.textContent).toBe("caught late");
  });

  it("keeps function children reactive", () => {
    let open = signal(false);
    let which = signal(true);
    const A = () => <u>a</u>;
    const B = () => <s>b</s>;
    const Pick = dynamic(() => (which ? A : B));
    const view = mount(() => (
      <Errored fallback={message}>
        <Show when={open}>
          <em>shown</em>
        </Show>
        <Pick />
      </Errored>
    ));
    expect(view.el.textContent).toBe("a");
    open = true;
    tick();
    tick();
    expect(view.el.textContent).toBe("showna");
    which = false;
    tick();
    tick();
    expect(view.el.textContent).toBe("shownb");
    open = false;
    tick();
    tick();
    expect(view.el.textContent).toBe("b");
  });

  it("leaves a healthy body alone", () => {
    const Dyn = dynamic(() => Fine);
    const view = mount(() => (
      <Errored fallback={message}>
        <Dyn />
      </Errored>
    ));
    expect(view.el.textContent).toBe("fine");
  });
});
