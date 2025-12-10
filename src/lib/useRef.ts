export function useRef<T extends HTMLElement>() {
  let ref: T | null;

  return {
    get() {
      return ref;
    },
    set(el: T) {
      ref = el;
    },
  };
}
