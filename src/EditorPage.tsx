import { useQuery } from "@tanstack/solid-query";
import { listen } from "@tauri-apps/api/event";
import { createSignal, Match, onMount, Switch } from "solid-js";
import { useDatabase } from "./database/useDatabase";
import { SqlEditor } from "./sql-editor/SqlEditor";
import { Table } from "./table/Table";
import { TableEditorProvider } from "./table/TableEditorProvider";

function useTableRowsDatabaseQuery() {
  const [writtenFile, setWrittenFile] = createSignal<string>();
  const db = useDatabase();

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

  return useQuery(() => ({
    queryFn: () => {
      const file = writtenFile();
      if (!file) {
        return [];
      }
      return db.select<Record<string, unknown>[]>(file);
    },
    queryKey: ["editor-query", writtenFile()],
  }));
}

export function EditorPage() {
  const rows = useTableRowsDatabaseQuery();

  const structure = () =>
    Object.keys(rows.data?.at(0) ?? {}).map((k) => ({
      columnName: k,
      dataType: "text" as const,
    }));

  return (
    <div class="grid grid-rows-2">
      <SqlEditor />
      <Switch>
        <Match when={rows.error}>{(error) => error().message}</Match>
        <Match when={rows.data}>
          {(rows) => (
            <TableEditorProvider rows={rows()}>
              <Table rows={rows()} structure={structure()} />
            </TableEditorProvider>
          )}
        </Match>
      </Switch>
    </div>
  );
}
