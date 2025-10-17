import { type Accessor, createEffect, on } from "solid-js";

export function createWatcher<T>(
  accessor: Accessor<T>,
  callback: (opts: { next: T; prev: T | undefined }) => void,
) {
  createEffect(on(accessor, (next, prev) => callback({ prev, next })));
}
