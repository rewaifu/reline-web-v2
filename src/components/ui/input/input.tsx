import { omitProps } from "reze-js";
import type { ComponentProps } from "reze-js";
import type { Component } from "~/types/component";
import styles from "./input.module.scss";

export type InputProps = ComponentProps<"input">;

export const Input: Component<InputProps> = (props) => {
  const rest = omitProps(props, ["class"]);
  return <input class={[styles.input, props.class]} {...rest} />;
};
