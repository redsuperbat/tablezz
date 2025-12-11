import { batch, createSignal } from "solid-js";
import { createWatcher } from "./commands/createWatcher";
import { createSolidContext } from "./createSolidContext";
import { useSelectedTableContext } from "./SelectedTableProvider";

interface Hop {
  query: string;
  previousRowIndex: number;
  previousColumnIndex: number;
}

export const [HopProvider, , useHopContext] = createSolidContext(() => {
  const { selectedTable } = useSelectedTableContext();
  const [hops, setHops] = createSignal<Hop[]>([]);
  const [position, setPosition] = createSignal<{ row: number; col: number }>();

  function add(hop: Hop) {
    batch(() => {
      setHops((h) => [...h, hop]);
      setPosition(undefined);
    });
  }

  // Reset position when table changes
  createWatcher(
    selectedTable,
    () => {
      batch(() => {
        setPosition(undefined);
        setHops([]);
      });
    },
    {
      // Do not run on initial render
      defer: true,
    },
  );

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
  };
});
