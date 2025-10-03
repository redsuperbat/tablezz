import { useCallback, useMemo, useState } from "react";

function wrap(value: number, min: number, max: number): number {
  if (value < min) return max;
  if (value > max) return min;
  return value;
}

function wrapWithZero(value: number, max: number): number {
  return wrap(value, 0, max);
}
export function useWrapWithZero(max: number) {
  const [value, setValue] = useState(0);

  const increment = useCallback(() => {
    setValue((v) => wrapWithZero(v + 1, max));
  }, [max]);

  const decrement = useCallback(() => {
    setValue((v) => wrapWithZero(v - 1, max));
  }, [max]);

  const reset = useCallback(() => {
    setValue(0);
  }, []);

  return useMemo(
    () => ({ increment, decrement, value, reset }),
    [increment, decrement, value, reset],
  );
}
