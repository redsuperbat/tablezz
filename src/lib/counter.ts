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

  const increment = (offset: number = 1) =>
    setValue((v) => wrapWithZero(v + offset, max()));

  const decrement = (offset: number = 1) =>
    setValue((v) => wrapWithZero(v - offset, max()));

  const reset = () => setValue(0);

  const setToMax = () => setValue(max());

  return { increment, decrement, value, reset, setToMax };
}

export function createCounterWithBoundaries({
  max,
  min,
  initialValue,
}: {
  max: Accessor<number>;
  min: number;
  initialValue?: number;
}) {
  const initial = initialValue !== undefined ? initialValue : min;

  const [value, setValue] = createSignal(initial);

  const increment = (offset = 1) =>
    setValue((v) => Math.min(v + offset, max()));

  const decrement = (offset = 1) => setValue((v) => Math.max(v - offset, min));

  const reset = () => setValue(initial);

  const setToMax = () => setValue(max());

  return { increment, decrement, value, reset, setToMax };
}
