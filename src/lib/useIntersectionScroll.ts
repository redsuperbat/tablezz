import { useEffect, useRef, useState } from "react";

export function useIntersectionScroll<T extends HTMLElement = HTMLDivElement>(
  shouldScrollIntoView: boolean = false,
) {
  const ref = useRef<T>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => entry && setIsInView(entry.isIntersecting),
      { threshold: 1.0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (shouldScrollIntoView && !isInView) {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [shouldScrollIntoView, isInView]);

  return { ref };
}
