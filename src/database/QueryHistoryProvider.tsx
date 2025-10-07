import { createSignal, For } from "solid-js";
import { createSolidContext } from "@/createSolidContext";

type QueryEntry = { query: string; createdAt: Date };

export const [QueryHistoryProvider, useQueryHistory] = createSolidContext(
  () => {
    const [entries, setEntries] = createSignal<QueryEntry[]>([]);

    const addEntry = (entry: QueryEntry) => setEntries((h) => [entry, ...h]);

    return { entries, addEntry };
  },
);

export function QueryHistory() {
  const history = useQueryHistory();

  return (
    <div class="overflow-auto">
      <For each={history?.entries()}>
        {(e) => <QueryHistoryEntry entry={e} />}
      </For>
    </div>
  );
}

function QueryHistoryEntry({ entry }: { entry: QueryEntry }) {
  return (
    <div class="flex gap-1">
      <span>{entry.createdAt.toLocaleTimeString()}</span>
      <span>{entry.query}</span>
    </div>
  );
}
