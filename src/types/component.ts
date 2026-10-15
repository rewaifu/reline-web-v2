import type { JSX } from "reze-js";

/** A component: runs once, reads props where it renders. */
export type Component<P extends object = object> = (props: P) => JSX.Element;

export type ParentProps<P extends object = object> = P & {
  children?: JSX.Element;
};
