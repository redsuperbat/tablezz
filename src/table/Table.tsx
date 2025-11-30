import { createSignal, For } from "solid-js";
import z from "zod";
import { useCommandsContext } from "@/commands/CommandsContext";
import { message } from "@/commands/Messages";
import { useRegisterKeybindCommandOnMount } from "@/keybinds/useRegisterKeybindCommand";
import { TableCell } from "./TableCell";
import { type Cell, useTableEditorContext } from "./TableEditorProvider";

export function Table(props: { reload: () => void }) {
  const { currentCell, visualBlock, getTable } = useTableEditorContext();
  const commandsContext = useCommandsContext();
  const [openedCell, setOpenedCell] = createSignal<Cell>();

  useRegisterKeybindCommandOnMount({
    command: "ReloadTable",
    keybindExpression: "r",
    action() {
      props.reload();
      message.info("Refreshed data");
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "SelectionCopyToClipboard",
    keybindExpression: "y",
    actionArgs: [
      z.coerce
        .number()
        .default(() => currentCell().column)
        .meta({ title: "<column>" }),

      z.coerce
        .number()
        .default(() => currentCell().row)
        .meta({ title: "<row>" }),
    ],
    action(column, row) {
      const block = visualBlock();
      const table = getTable();

      if (block) {
        const cells = table.getAllCells();

        const intersectingCells = cells.filter((cell) =>
          block.isIntersectingWith(cell),
        );

        const cellsByRow = Map.groupBy(intersectingCells, (c) => c.row);

        const sortedRows = Array.from(cellsByRow.entries()).sort(
          ([rowA], [rowB]) => rowA - rowB,
        );

        const values = sortedRows
          .map(([_, rowCells]) => {
            return rowCells
              .sort((a, b) => a.column - b.column)
              .map((c) => c.getData().toString())
              .join("\t");
          })
          .join("\n");

        navigator.clipboard.writeText(values);
        message.info("Copied to clipboard");
        commandsContext.triggerCommand("VisualModeExit");
        return;
      }

      const cell = table.getCell(row, column);
      if (!cell) return;
      navigator.clipboard.writeText(cell.getData().toString());
      message.info("Copied to clipboard");
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "SelectionOpen",
    keybindExpression: "K",
    actionArgs: [
      z.coerce
        .number()
        .default(() => currentCell().column)
        .meta({ title: "<column>" }),

      z.coerce
        .number()
        .default(() => currentCell().row)
        .meta({ title: "<row>" }),
    ],
    action(column, row) {
      const cell = getTable().getCellOrThrow(row, column);
      setOpenedCell(cell);
    },
  });

  return (
    <div class="overflow-y-auto">
      <table>
        <thead class="sticky top-0 z-10 bg-white">
          <tr class="border-gray-300 border-b">
            <For each={getTable().getColumns()}>
              {(column) => <th>{column.getName()}</th>}
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
