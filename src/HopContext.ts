import { createSignal } from "solid-js";
import { createSolidContext } from "./createSolidContext";

interface Hop {
  query: string;
  previousColumnIndex: number;
  previousRowIndex: number;
}

export const [HopProvider, , useHopContext] = createSolidContext(() => {
  const [hops, setHops] = createSignal<Hop[]>([]);

  function add(hop: Hop) {
    setHops((h) => [...h, hop]);
  }

  function pop() {
    let popped: Hop | undefined;

    setHops((h) => {
      popped = h.pop();
      return [...h];
    });

    return popped;
  }

  return {
    value: hops,
    add,
    pop,
    isEmpty: () => hops().length === 0,
  };
});
