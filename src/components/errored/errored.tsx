import { catchError, effect, signal, type JSX } from "reze-js";
import type { Component } from "~/types/component";

export interface ErroredProps {
  /** Shown in place of `children` once anything built inside throws. */
  fallback: (error: () => unknown) => JSX.Element;
  children?: JSX.Element;
}

/**
 * Shows `children`. An error thrown while they render, or by a binding or
 * effect created inside them later, disposes the body and swaps in `fallback`.
 * The error reaches `fallback` through an accessor.
 */
export const Errored: Component<ErroredProps> = (props) => {
  let failed = signal(false);
  let error = signal<unknown>(undefined);

  // True while the body is being built by the closure below, which reads
  // `failed` right after: a write then is seen at once. Any other failure
  // happens inside an effect of the parent's (a child binding being evaluated),
  // and a signal written from inside the effect that reads it does not wake
  // it — so the write is moved out of the running flush.
  let building = false;
  const fail = (caught: unknown): void => {
    const apply = () => {
      error = caught;
      failed = true;
    };
    if (building) apply();
    else queueMicrotask(apply);
  };

  // A child that is a binding (`Show`, `dynamic`, a ternary) builds its nodes
  // when the parent inserts it, after `catchError` below has returned — outside
  // its reach — and `catchError` itself runs untracked, so it cannot simply
  // wrap the evaluation. Each such function is evaluated here instead, by an
  // effect that belongs to the `catchError` scope; the parent inserts what the
  // effect produced.
  const guard = (value: unknown): unknown => {
    if (typeof value === "function") {
      let out = signal<unknown>(undefined);
      effect(() => {
        out = guard((value as () => unknown)());
      });
      return () => out;
    }
    return Array.isArray(value) ? value.map(guard) : value;
  };

  return () => {
    // a throw while the body is built fails before `catchError` returns, so
    // `failed` is read after the build, not only when it changes later
    building = true;
    const body = failed
      ? undefined
      : catchError(() => guard(props.children), fail);
    building = false;
    return failed ? props.fallback(() => error) : (body as JSX.Element);
  };
};
