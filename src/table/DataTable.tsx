import { createSignal, For } from "solid-js";
import z from "zod";
import { useCommandsContext } from "@/commands/CommandsContext";
import { message } from "@/commands/Messages";
import { useRegisterKeybindCommandOnMount } from "@/keybinds/useRegisterKeybindCommand";
import type { Cell } from "./Cell";
import { TableCell } from "./DataTableCell";
import { useTableEditorContext } from "./DataTableProvider";

export function DataTable(props: { reload: () => void }) {
  const { currentCell, visualSelection, getTable } = useTableEditorContext();
  const commandsContext = useCommandsContext();
  const [openedCell, setOpenedCell] = createSignal<Cell>();

  useRegisterKeybindCommandOnMount({
    command: "ReloadTable",
    keybindExpression: "r",
    action() {
      props.reload();
      message.info("Reloaded table data");
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "SelectionCopyToClipboard",
    keybindExpression: "y",
    action() {
      const values = visualSelection().intersectingCellsToString({
        // Use these delimiters since it's useful for excel
        columnDelimiter: "\n",
        rowDelimiter: "\t",
      });
      navigator.clipboard.writeText(values);
      message.info("Copied to clipboard");
      commandsContext.triggerCommand("VisualModeExit");
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "SelectionOpen",
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
    <div class="overflow-y-auto">
      <table>
        <thead class="sticky top-0 z-10 bg-white">
          <tr class="border-gray-300 border-b">
            <For each={getTable().getColumns()}>
              {(column) => <th class="px-4">{column.getName()}</th>}
            </For>
          </tr>
        </thead>
        <tbody>
          <For each={getTable().getRows()}>
            {(row) => (
              <tr>
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
