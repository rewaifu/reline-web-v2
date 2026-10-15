import { splitProps } from "reze-js";
import type { PropsOf } from "reze-js";
import type { Component } from "~/types/component";
import styles from "./input.module.scss";

export type InputProps = PropsOf<"input">;

export const Input: Component<InputProps> = (props) => {
  const [, rest] = splitProps(props, ["class"]);
  return <input class={[styles.input, props.class]} {...rest} />;
};
