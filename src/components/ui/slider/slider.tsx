import { splitProps } from "reze-js";
import type { Component } from "~/types/component";
import styles from "./slider.module.scss";

export interface UiSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  id?: string;
  class?: string;
}

/** Track + thumb slider over a native range input — keyboard and pointer
 * behavior come from the platform, the chrome is fully styled. `--fill`
 * paints the progress up to the thumb on WebKit (Firefox has
 * ::-moz-range-progress). */
export const UiSlider: Component<UiSliderProps> = (props) => {
  const [, rest] = splitProps(props, [
    "onChange",
    "value",
    "min",
    "max",
    "step",
    "id",
    "class",
  ]);

  return (
    <input
      {...rest}
      id={props.id}
      class={[styles.slider, props.class]}
      type="range"
      min={props.min ?? 0}
      max={props.max ?? 100}
      step={props.step ?? 1}
      value={props.value}
      style={{
        "--fill": `${((props.value - (props.min ?? 0)) / Math.max(1, (props.max ?? 100) - (props.min ?? 0))) * 100}%`,
      }}
      onInput={(e) => props.onChange(Number(e.currentTarget.value))}
    />
  );
};
