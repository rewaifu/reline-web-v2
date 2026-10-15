import { splitProps } from "reze-js";
import type { PropsOf } from "reze-js";
import type { Component } from "~/types/component";
import styles from "./label.module.scss";

export type LabelProps = PropsOf<"label">;

export const Label: Component<LabelProps> = (props) => {
  const [, rest] = splitProps(props, ["class"]);
  return <label class={[styles.label, props.class]} {...rest} />;
};
