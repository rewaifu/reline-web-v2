import { catchError, signal, type JSX } from "reze-js";
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

  return () => {
    // a throw while the body is built fails before `catchError` returns, so
    // `failed` is read after the build, not only when it changes later
    const body = failed
      ? undefined
      : catchError(
          () => props.children,
          (caught) => {
            error = caught;
            failed = true;
          },
        );
    return failed ? props.fallback(() => error) : body;
  };
};
