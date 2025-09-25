import { useCallback, useState } from "react";
import { createReactContext } from "@/createReactContext";

type QueryEntry = { query: string; createdAt: Date };

export const [QueryHistoryProvider, , useQueryHistory] = createReactContext(
  () => {
    const [entries, setEntries] = useState<QueryEntry[]>([]);

    const addEntry = useCallback(
      (entry: QueryEntry) => setEntries((h) => [entry, ...h]),
      [],
    );

    return { entries, addEntry };
  },
);

export function QueryHistory() {
  const history = useQueryHistory();

  return (
    <div className="overflow-auto">
      {history.entries.map((e, index) => (
        <QueryHistoryEntry key={e.query.concat(index.toString())} entry={e} />
      ))}
    </div>
  );
}
function QueryHistoryEntry({ entry }: { entry: QueryEntry }) {
  return (
    <div className="flex gap-1">
      <span>{entry.createdAt.toLocaleTimeString()}</span>
      <span>{entry.query}</span>
    </div>
  );
}
