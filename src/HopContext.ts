import { batch, createSignal } from "solid-js";
import { createSolidContext } from "./createSolidContext";

interface Hop {
  query: string;
  previousRowIndex: number;
  previousColumnIndex: number;
}

export const [HopProvider, , useHopContext] = createSolidContext(() => {
  const [hops, setHops] = createSignal<Hop[]>([]);
  const [position, setPosition] = createSignal<{ row: number; col: number }>();

  function add(hop: Hop) {
    batch(() => {
      setHops((h) => [...h, hop]);
      setPosition(undefined);
    });
  }

  function pop() {
    const currentHops = hops();
    const popped = currentHops.at(-1);

    batch(() => {
      setHops(currentHops.slice(0, -1));
      if (!popped) return;
      setPosition({
        row: popped.previousRowIndex,
        col: popped.previousColumnIndex,
      });
    });

    return popped;
  }

  return {
    value: hops,
    add,
    pop,
    isEmpty: () => hops().length === 0,
    position,
    setPosition,
  };
});
