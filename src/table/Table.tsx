import {
  type ColumnDef,
  createSolidTable,
  flexRender,
  getCoreRowModel,
} from "@tanstack/solid-table";
import { createSignal, For } from "solid-js";
import z from "zod";
import { message } from "@/commands/Messages";
import { useRegisterKeybindCommandOnMount } from "@/keybinds/useRegisterKeybindCommand";
import type { PostgresDataType } from "@/useTableStructure";
import { TableCell } from "./TableCell";
import { useTableEditorContext } from "./TableEditorProvider";

export function Table(props: {
  rows: Record<string, unknown>[];
  structure: { columnName: string; dataType: PostgresDataType }[];
}) {
  let ref: HTMLTableElement | undefined;
  const { column, row } = useTableEditorContext();
  const [openedCell, setOpenedCell] = createSignal<{
    row: number;
    column: number;
  }>();

  useRegisterKeybindCommandOnMount({
    command: "SelectionCopyToClipboard",
    keybindExpression: "y",
    actionArgs: [
      z.coerce
        .number()
        .default(() => column())
        .meta({ title: "<column>" }),

      z.coerce
        .number()
        .default(() => row())
        .meta({ title: "<row>" }),
    ],
    action(column, row) {
      const key = props.structure.at(column)?.columnName;
      if (!key) return;
      const data = props.rows.at(row)?.[key];
      if (data === undefined) return;
      navigator.clipboard.writeText(String(data));
      message.info("Copied to clipboard");
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "SelectionOpen",
    keybindExpression: "K",
    actionArgs: [
      z.coerce
        .number()
        .default(() => column())
        .meta({ title: "<column>" }),

      z.coerce
        .number()
        .default(() => row())
        .meta({ title: "<row>" }),
    ],
    action(column, row) {
      setOpenedCell({ column, row });
    },
  });

  const columns: () => ColumnDef<Record<string, unknown>>[] = () =>
    props.structure.map((s) => ({
      id: s.columnName,
      accessorKey: s.columnName,
      header(props) {
        return <div class="px-1">{props.header.id}</div>;
      },
      cell: (props) => (
        <TableCell
          columnIndex={props.column.getIndex()}
          openedCell={openedCell()}
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
    <div class="overflow-y-auto">
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
