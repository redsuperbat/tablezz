import { makePersisted } from "@solid-primitives/storage";
import { createSignal } from "solid-js";
import { message } from "./commands/Messages";
import { createSolidContext } from "./createSolidContext";

interface Hop {
  query: string;
  rowIndex: number;
  columnIndex: number;
}

export const [HopProvider, , useHopContext] = createSolidContext(() => {
  const [hops, setHops] = makePersisted(createSignal<Hop[]>([]), {
    name: "hops@",
  });

  function add(hop: { query: string }) {
    setHops((h) => [...h, { query: hop.query, columnIndex: 0, rowIndex: 0 }]);
  }

  function pop() {
    if (hops().length === 1) {
      message.error("Can not hop past the last item in the stack");
      return;
    }

    setHops((h) => h.slice(0, -1));
  }

  function clear() {
    setHops([]);
  }

  function currentHop() {
    return hops().at(-1) as Hop;
  }

  function updateCurrentHop(cb: (h: Hop) => Hop) {
    const current = currentHop();

    if (!current) {
      return;
    }

    setHops((h) => {
      const newHops = [...h];
      const current = newHops.at(-1);
      if (!current) return newHops;
      newHops[newHops.length - 1] = cb(current);
      return newHops;
    });
  }

  function setColumnIndex(cb: (columnIndex: number) => number) {
    updateCurrentHop((h) => {
      h.columnIndex = cb(h.columnIndex);
      return h;
    });
  }

  function setRowIndex(cb: (columnIndex: number) => number) {
    updateCurrentHop((h) => {
      h.rowIndex = cb(h.rowIndex);
      return h;
    });
  }

  return {
    current: currentHop,
    setRowIndex,
    setColumnIndex,
    clear,
    add,
    pop,
    isEmpty: () => hops().length === 0,
  };
});
