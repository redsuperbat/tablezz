import { onCleanup } from "solid-js";

export function useDisposables() {
  const disposables = new Set<() => void>();

  onCleanup(() => {
    disposables.forEach((d) => d());
  });

  return { add: (d: () => void) => void disposables.add(d) };
}
