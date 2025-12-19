import { createSignal } from "solid-js";
import { createSolidContext } from "./createSolidContext";

interface Hop {
  query: string;
  rowIndex: number;
  columnIndex: number;
}

export const [HopProvider, , useHopContext] = createSolidContext(() => {
  const [hops, setHops] = createSignal<Hop[]>([]);

  function add(hop: { query: string }) {
    setHops((h) => [...h, { query: hop.query, columnIndex: 0, rowIndex: 0 }]);
  }

  function pop() {
    setHops((h) => h.slice(0, -1));
  }

  function currentHop() {
    return hops().at(-1) as Hop;
  }

  function set(dimension: "row" | "column", index: number) {
    setHops((h) => {
      const newHops = [...h];
      const current = newHops.at(-1);
      if (!current) return newHops;

      if (dimension === "row") {
        current.rowIndex = index;
      } else {
        current.columnIndex = index;
      }

      return newHops;
    });
  }

  function increment(dimension: "row" | "column", offset = 1) {
    const current = currentHop();

    if (!current) {
      return;
    }

    setHops((h) => {
      const newHops = [...h];
      const current = newHops.at(-1);
      if (!current) return newHops;

      if (dimension === "row") {
        current.rowIndex += offset;
      } else {
        current.columnIndex += offset;
      }

      return newHops;
    });
  }

  function decrement(dimension: "row" | "column", offset = 1) {
    const current = currentHop();
    if (!current) {
      return;
    }

    setHops((h) => {
      const newHops = [...h];
      const current = newHops.at(-1);
      if (!current) return newHops;

      if (dimension === "row") {
        current.rowIndex -= offset;
      } else {
        current.columnIndex -= offset;
      }

      return newHops;
    });
  }

  return {
    current: currentHop,
    add,
    pop,
    currentIndex: {
      decrement,
      increment,
      set,
    },
    isEmpty: () => hops().length === 0,
    position: () => ({
      rowIndex: currentHop()?.rowIndex,
      columnIndex: currentHop()?.columnIndex,
    }),
  };
});
