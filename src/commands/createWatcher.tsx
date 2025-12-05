import { type Accessor, createEffect, on } from "solid-js";

export function createWatcher<T>(
  accessor: Accessor<T>,
  callback: (opts: { next: T; prev: T | undefined }) => void,
  opts?: {
    defer?: boolean;
  },
) {
  createEffect(
    on(accessor, (next, prev) => callback({ prev, next }), {
      defer: opts?.defer,
    }),
  );
}
