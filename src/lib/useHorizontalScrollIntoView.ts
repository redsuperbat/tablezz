import { type Accessor, createEffect } from "solid-js";

export function useHorizontalScrollIntoView<
  T extends HTMLElement = HTMLDivElement,
>(
  shouldScrollIntoView: Accessor<boolean>,
  getContainer: () => HTMLElement | null | undefined,
) {
  let ref: T | undefined;

  createEffect(() => {
    if (!ref || !shouldScrollIntoView()) return;

    const container = getContainer();
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const elRect = ref.getBoundingClientRect();

    const isHorizontallyVisible =
      elRect.left >= containerRect.left && elRect.right <= containerRect.right;

    if (!isHorizontallyVisible) {
      if (elRect.left < containerRect.left) {
        container.scrollLeft += elRect.left - containerRect.left;
      } else {
        container.scrollLeft += elRect.right - containerRect.right;
      }
    }
  });

  return (r: T) => {
    ref = r;
  };
}
