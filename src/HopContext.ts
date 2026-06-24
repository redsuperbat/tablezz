import { makePersisted } from "@solid-primitives/storage";
import { createSignal } from "solid-js";
import { createSolidContext } from "./createSolidContext";

interface Hop {
  query: string;
  rowIndex: number;
  columnIndex: number;
  scrollX: number;
  scrollY: number;
}

export const [HopProvider, , useHopContext] = createSolidContext(() => {
  const [hops, setHops] = makePersisted(createSignal<Hop[]>([]), {
    name: "hops",
  });

  function add(hop: { query: string }) {
    setHops((h) => [
      ...h,
      { query: hop.query, columnIndex: 0, rowIndex: 0, scrollX: 0, scrollY: 0 },
    ]);
  }

  function pop() {
    if (hops().length === 1) {
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

  function setScrollX(cb: (scrollX: number) => number) {
    updateCurrentHop((h) => {
      h.scrollX = cb(h.scrollX);
      return h;
    });
  }

  function setScrollY(cb: (scrollY: number) => number) {
    updateCurrentHop((h) => {
      h.scrollY = cb(h.scrollY);
      return h;
    });
  }

  return {
    current: currentHop,
    setRowIndex,
    setColumnIndex,
    setScrollX,
    setScrollY,
    clear,
    add,
    pop,
  };
});
