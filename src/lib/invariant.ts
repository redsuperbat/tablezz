export function invariant<T>(
  value: T | undefined | null,
  message = "",
): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(`Invariant failed: value is undefined or null ${message}`);
  }
}
