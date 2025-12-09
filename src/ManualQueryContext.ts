import { createSignal } from "solid-js";
import { createSolidContext } from "./createSolidContext";

export const [ManualQueryProvider, , useManualQueryContext] =
  createSolidContext(() => {
    const [manualQuery, setManualQuery] = createSignal<string[]>([]);

    function add(query: string) {
      setManualQuery((q) => [...q, query]);
    }

    function pop() {
      setManualQuery((q) => q.slice(0, -1));
    }

    return {
      value: manualQuery,
      add,
      pop,
      isEmpty: () => manualQuery().length === 0,
    };
  });
