import { Binary, Braces, Calendar, Hash, Key, List, Type } from "lucide-solid";
import { createSignal, For, Show } from "solid-js";
import z from "zod";
import { message } from "@/commands/Messages";
import { useRegisterKeybindCommandOnMount } from "@/keybinds/useRegisterKeybindCommand";
import type { PostgresDataType } from "@/useTableStructure";
import type { Cell } from "./Cell";
import type { Column } from "./Column";
import { TableCell } from "./DataTableCell";
import { useTableEditorContext } from "./DataTableProvider";

function getDataTypeIcon(dataType: PostgresDataType) {
  const isArray = dataType.endsWith("[]");

  if (isArray) {
    return List;
  }

  switch (dataType) {
    case "json":
    case "jsonb":
      return Braces;
    case "integer":
    case "numeric":
    case "bigint":
    case "smallint":
      return Hash;
    case "date":
    case "time":
    case "time without time zone":
    case "time with time zone":
    case "timestamp(3)":
    case "timestamp(3) without time zone":
    case "timestamp(3) with time zone":
      return Calendar;
    case "vector":
      return Binary;
    default:
      return Type;
  }
}

function ColumnHeader(props: { column: Column }) {
  const DataTypeIcon = getDataTypeIcon(props.column.rawType);

  return (
    <th class="px-3 py-2 text-left font-medium text-base text-zinc-600">
      <div class="flex items-center gap-1.5">
        <Show when={props.column.isPrimary}>
          <Key class="h-3.5 w-3.5 text-amber-500" />
        </Show>
        <DataTypeIcon class="h-3.5 w-3.5 text-zinc-400" />
        <span>{props.column.name}</span>
        <Show when={props.column.isNullable}>
          <span class="font-semibold text-blue-400 text-xs">?</span>
        </Show>
      </div>
    </th>
  );
}

export function DataTable(props: { reload: () => void }) {
  const { currentCell, visualSelection, getTable } = useTableEditorContext();
  const [openedCell, setOpenedCell] = createSignal<Cell>();

  useRegisterKeybindCommandOnMount({
    command: "ReloadTable",
    description: "Reload the current table data.",
    keybindExpression: "r",
    action() {
      props.reload();
      message.info("Reloaded table data");
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "SelectionCopyToClipboard",
    description: "Copy the selected cells to the clipboard.",
    keybindExpression: "y",
    action() {
      const values = visualSelection().intersectingCellsToString({
        // Use these delimiters since it's useful for excel
        columnDelimiter: "\t",
        rowDelimiter: "\n",
      });
      navigator.clipboard.writeText(values);
      message.info("Copied to clipboard");
      visualSelection().exit();
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "SelectionOpen",
    description: "Open a cell for inline viewing.",
    keybindExpression: "K",
    actionArgs: [
      z.coerce
        .number()
        .default(() => currentCell().getColumn().index)
        .meta({ title: "<column>" }),

      z.coerce
        .number()
        .default(() => currentCell().getRow().index)
        .meta({ title: "<row>" }),
    ],
    action(column, row) {
      const cell = getTable().getCellOrThrow({ row, column });
      setOpenedCell(cell);
    },
  });

  return (
    <div class="overflow-y-auto bg-zinc-50">
      <table class="w-full border-separate border-spacing-0">
        <thead class="sticky top-0 z-10 bg-zinc-100/95 backdrop-blur-sm">
          <tr class="border-zinc-300 border-b">
            <For each={getTable().getColumns()}>
              {(column) => <ColumnHeader column={column} />}
            </For>
          </tr>
        </thead>
        <tbody class="bg-white">
          <For each={getTable().getRows()}>
            {(row) => (
              <tr class="transition-colors hover:bg-zinc-50/50">
                <For each={row.getCells()}>
                  {(cell) => (
                    <TableCell
                      clearOpenedCell={() => setOpenedCell(undefined)}
                      cell={cell}
                      openedCell={openedCell()}
                    />
                  )}
                </For>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}
