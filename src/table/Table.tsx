import { For, Match, Switch } from "solid-js";
import { useTableRows } from "@/useTableRows";
import { TableEditorProvider } from "./TableEditorProvider";
import { TableRow } from "./TableRow";

export function Table(props: { tableName: string }) {
  const rows = useTableRows(() => props.tableName);

  const structure = () =>
    Object.keys(rows.data?.at(0) ?? {}).map((k) => ({
      columnName: k,
      dataType: "text" as const,
    }));

  return (
    <Switch>
      <Match when={rows.isError}>
        <div>{rows.error?.message}</div>
      </Match>

      <Match when={rows.data}>
        <TableEditorProvider>
          <div class="overflow-scroll h-full font-normal text-start">
            <table class="border-spacing-x-4 table-auto border-collapse border border-gray-300 w-full text-sm">
              <thead>
                <tr>
                  <For each={structure()}>
                    {(s) => (
                      <th class="border border-gray-300 px-4 py-2">
                        {s.columnName}
                      </th>
                    )}
                  </For>
                </tr>
              </thead>
              <tbody>
                <For each={rows.data}>
                  {(row, rowIndex) => {
                    return (
                      <TableRow
                        rowIndex={rowIndex()}
                        row={row}
                        structure={structure()}
                      />
                    );
                  }}
                </For>
              </tbody>
            </table>
          </div>
        </TableEditorProvider>
      </Match>
    </Switch>
  );
}
