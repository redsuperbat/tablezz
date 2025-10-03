import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ErrorResult<T> = [Error, null] | [null, T];

export function tryCatch<T>(fn: () => T): ErrorResult<T>;
export function tryCatch<T>(fn: Promise<T>): Promise<ErrorResult<T>>;
export function tryCatch<T>(
  fn: (() => T) | Promise<T>,
): ErrorResult<T> | Promise<ErrorResult<T>> {
  if (fn instanceof Promise) {
    return fn
      .then((value): ErrorResult<T> => [null, value])
      .catch(
        (error): ErrorResult<T> => [
          error instanceof Error ? error : new Error(String(error)),
          null,
        ],
      );
  }

  try {
    return [null, fn()];
  } catch (error) {
    return [error instanceof Error ? error : new Error(String(error)), null];
  }
}

export function wrap(value: number, min: number, max: number): number {
  if (value < min) return max;
  if (value > max) return min;
  return value;
}

export function wrapWithZero(value: number, max: number): number {
  return wrap(value, 0, max);
}
