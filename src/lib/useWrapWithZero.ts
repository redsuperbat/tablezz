import { type Accessor, createSignal } from "solid-js";

function wrap(value: number, min: number, max: number): number {
  if (value < min) return max;
  if (value > max) return min;
  return value;
}

function wrapWithZero(value: number, max: number): number {
  return wrap(value, 0, max);
}
export function createCounterWithWrap(max: Accessor<number>) {
  const [value, setValue] = createSignal(0);

  const increment = () => setValue((v) => wrapWithZero(v + 1, max()));

  const decrement = () => setValue((v) => wrapWithZero(v - 1, max()));

  const reset = () => setValue(0);

  return { increment, decrement, value, reset };
}
