export type ErrorResult<T> = [Error, null] | [null, T];

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
