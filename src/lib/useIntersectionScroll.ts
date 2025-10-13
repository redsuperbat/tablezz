import {
  type Accessor,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";

export function useIntersectionScroll<T extends HTMLElement = HTMLDivElement>(
  shouldScrollIntoView: Accessor<boolean>,
) {
  let ref: T | undefined;
  const [isInView, setIsInView] = createSignal(false);
  const observer = new IntersectionObserver(
    ([entry]) => entry && setIsInView(entry.isIntersecting),
    { threshold: 1.0 },
  );

  onMount(() => {
    if (!ref) return;
    observer.observe(ref);
  });

  onCleanup(() => observer?.disconnect());

  createEffect(() => {
    if (!ref) return;
    if (shouldScrollIntoView() && !isInView()) {
      ref.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });

  return (r: T) => {
    ref = r;
  };
}
