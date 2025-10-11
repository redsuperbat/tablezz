import { useQuery } from "@tanstack/solid-query";
import { listen } from "@tauri-apps/api/event";
import { createMemo, createSignal, onMount } from "solid-js";
import { useDatabase } from "./database/useDatabase";
import { useSchemaContext } from "./SchemaProvider";

function useTableRowsDatabaseQuery(tableName: () => string) {
  const { schema } = useSchemaContext();
  const [writtenFile, setWrittenFile] = createSignal<string>();

  onMount(() => {
    const fileChanged = listen("file-changed", (e) => {
      setWrittenFile(String(e.payload));
    });

    const exit = listen("pty-exit", () => setWrittenFile(undefined));

    return () => {
      fileChanged.then((u) => u());
      exit.then((u) => u());
    };
  });

  return createMemo(() => {
    const file = writtenFile();

    if (file) return file;

    return `SELECT * FROM ${schema()}.${tableName()}`;
  });
}

export function useTableRows(tableName: () => string) {
  const database = useDatabase();
  const query = useTableRowsDatabaseQuery(tableName);

  return useQuery(() => ({
    queryFn: () => database.select<Record<string, unknown>[]>(query()),

    queryKey: ["table-content", query(), tableName()],
  }));
}
