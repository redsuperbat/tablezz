import { createVirtualizer } from "@tanstack/solid-virtual";
import { Key, Link2 } from "lucide-solid";
import { createSignal, For, onMount, Show } from "solid-js";
import type { JSX } from "solid-js/jsx-runtime";
import z from "zod";
import { createWatcher } from "@/commands/createWatcher";
import { message } from "@/commands/Messages";
import { useRegisterKeybindCommandOnMount } from "@/keybinds/useRegisterKeybindCommand";
import { cn } from "@/lib/cn";
import type { Cell } from "./Cell";
import type { Column } from "./Column";
import { TableCell } from "./DataTableCell";
import { useTableEditorContext } from "./DataTableProvider";
import type { Row } from "./Row";

function ColumnHeader(props: { column: Column }) {
  return (
    <div class="whitespace-nowrap px-3 py-2 text-left font-medium text-base text-zinc-600">
      <div class="flex items-center gap-1.5">
        <Show when={props.column.isPrimary}>
          <Key class="h-3.5 w-3.5 text-amber-500" />
        </Show>
        <Show when={props.column.foreignKey}>
          <Link2 class="h-3.5 w-3.5 text-blue-500" />
        </Show>
        {props.column.getDataType().icon("h-3.5 w-3.5 text-zinc-400")}
        <span>{props.column.name}</span>
        <Show when={props.column.isNullable}>
          <span class="font-semibold text-blue-400 text-xs">?</span>
        </Show>
      </div>
    </div>
  );
}

function TableRow(props: {
  row: Row;
  openedCell?: Cell;
  clearOpenedCell: () => void;
  ref?: (el: HTMLElement) => void;
  style: JSX.CSSProperties;
}) {
  const [rerender, forceRerender] = createSignal({});

  onMount(() => {
    props.row.setForceRerender(() => forceRerender({}));
  });

  const isDeleted = () => {
    rerender();
    return props.row.isDeleted;
  };

  return (
    <div
      ref={props.ref}
      class={cn("bg-white", isDeleted() && "bg-red-500/10 line-through")}
      style={props.style}
    >
      <For each={props.row.getCells()}>
        {(cell) => (
          <TableCell
            clearOpenedCell={props.clearOpenedCell}
            cell={cell}
            openedCell={props.openedCell}
          />
        )}
      </For>
    </div>
  );
}

export function DataTable(props: { reload: () => void }) {
  const {
    currentCell,
    visualSelection,
    getTable,
    tableContainerRef,
    numberOfVisibleRows: visibleRows,
    rowRef,
    rowHeight,
  } = useTableEditorContext();
  const [openedCell, setOpenedCell] = createSignal<Cell>();

  const virtualizer = createVirtualizer({
    get count() {
      return getTable().getRows().length;
    },
    get scrollPaddingStart() {
      return rowHeight();
    },
    getScrollElement: () => tableContainerRef.get(),
    estimateSize: () => rowHeight(),
    get overscan() {
      return Math.round(visibleRows() / 2);
    },
  });

  createWatcher(
    () => currentCell()?.getRow().index,
    (rowIndex) => {
      if (rowIndex.next !== undefined) {
        virtualizer.scrollToIndex(rowIndex.next, { align: "auto" });
      }
    },
  );

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
        .default(() => currentCell()?.getColumn().index ?? 0)
        .meta({ title: "<column>" }),

      z.coerce
        .number()
        .default(() => currentCell()?.getRow().index ?? 0)
        .meta({ title: "<row>" }),
    ],
    action(column, row) {
      const cell = getTable().getCellOrThrow({ row, column });
      setOpenedCell(cell);
    },
  });

  return (
    <div ref={tableContainerRef.set} class="overflow-auto bg-zinc-50">
      <div
        class="relative grid w-max min-w-full bg-white"
        style={{
          "grid-template-columns": `repeat(${getTable().getColumns().length}, minmax(150px, max-content))`,
          "padding-top": `${virtualizer.getVirtualItems()[0]?.start ?? 0}px`,
          "margin-bottom": `${virtualizer.getTotalSize() - (virtualizer.getVirtualItems().at(-1)?.end ?? 0)}px`,
        }}
      >
        <div
          class="sticky top-0 bg-white"
          style={{
            display: "grid",
            "grid-template-columns": "subgrid",
            "grid-column": "1 / -1",
            height: `${rowHeight()}px`,
          }}
        >
          <For each={getTable().getColumns()}>
            {(column) => <ColumnHeader column={column} />}
          </For>
        </div>

        <For each={virtualizer.getVirtualItems()}>
          {(virtualRow) => {
            const row = getTable().getRows()[virtualRow.index];
            if (!row) return null;
            return (
              <TableRow
                style={{
                  display: "grid",
                  "grid-template-columns": "subgrid",
                  "grid-column": "1 / -1",
                }}
                ref={virtualRow.index === 0 ? rowRef.set : undefined}
                row={row}
                openedCell={openedCell()}
                clearOpenedCell={() => setOpenedCell(undefined)}
              />
            );
          }}
        </For>
      </div>
    </div>
  );
}
