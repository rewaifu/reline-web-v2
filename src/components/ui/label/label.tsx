import { omitProps } from "reze-js";
import type { ComponentProps } from "reze-js";
import type { Component } from "~/types/component";
import styles from "./label.module.scss";

export type LabelProps = ComponentProps<"label">;

export const Label: Component<LabelProps> = (props) => {
  const rest = omitProps(props, ["class"]);
  return <label class={[styles.label, props.class]} {...rest} />;
};
