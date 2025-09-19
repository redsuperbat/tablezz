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
		<div>
			{history.entries.map((e) => (
				<div key={e.createdAt.toISOString()}>{e.query}</div>
			))}
		</div>
	);
}
