import {
  type ColumnDef,
  createSolidTable,
  flexRender,
  getCoreRowModel,
} from "@tanstack/solid-table";
import { For } from "solid-js";
import { useRegisterKeybindCommand } from "@/keybinds/useRegisterKeybindCommand";
import { TableCell } from "./TableCell";

export function Table(props: { rows: Record<string, unknown>[] }) {
  let ref: HTMLTableElement | undefined;

  useRegisterKeybindCommand({
    command: "FocusTable",
    keybindExpression: "Control + j",
    overrideInput: true,
    action() {
      setTimeout(() => {
        ref?.focus();
      }, 100);
    },
  });

  const structure = () =>
    Object.keys(props.rows.at(0) ?? {}).map((k) => ({
      columnName: k,
      dataType: "text" as const,
    }));

  const columns: () => ColumnDef<Record<string, unknown>>[] = () =>
    structure().map((s) => ({
      accessorKey: s.columnName,
      cell: (props) => (
        <TableCell
          columnIndex={props.column.getIndex()}
          data={props.getValue()}
          dataType={s.dataType}
          rowIndex={props.row.index}
        />
      ),
    }));

  const table = () =>
    createSolidTable({
      columns: columns(),
      get data() {
        return props.rows ?? [];
      },
      getCoreRowModel: getCoreRowModel(),
    });

  return (
    <div class="overflow-auto">
      <table ref={ref}>
        <thead>
          <For each={table().getHeaderGroups()}>
            {(headerGroup) => (
              <tr>
                <For each={headerGroup.headers}>
                  {(header) => (
                    <th class="sticky top-0">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                    </th>
                  )}
                </For>
              </tr>
            )}
          </For>
        </thead>
        <tbody>
          <For each={table().getRowModel().rows}>
            {(row) => (
              <tr>
                <For each={row.getVisibleCells()}>
                  {(cell) =>
                    flexRender(cell.column.columnDef.cell, cell.getContext())
                  }
                </For>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}
