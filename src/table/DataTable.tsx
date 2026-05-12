import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";
import z from "zod";
import { createWatcher } from "@/commands/createWatcher";
import { message } from "@/commands/Messages";
import { useRegisterKeybindCommandOnMount } from "@/keybinds/useRegisterKeybindCommand";
import type { Cell } from "./Cell";
import { CanvasColumnLayout } from "./canvas/CanvasColumnLayout";
import {
  CanvasRenderer,
  HEADER_HEIGHT,
  ROW_HEIGHT,
} from "./canvas/CanvasRenderer";
import { useTableEditorContext } from "./DataTableProvider";

export function DataTable(props: { reload?: () => void }) {
  const { currentCell, visualSelection, getTable, tableContainerRef } =
    useTableEditorContext();

  const [openedCell, setOpenedCell] = createSignal<Cell>();
  const [scrollX, setScrollX] = createSignal(0);
  const [scrollY, setScrollY] = createSignal(0);
  const [canvasWidth, setCanvasWidth] = createSignal(0);
  const [canvasHeight, setCanvasHeight] = createSignal(0);
  const [renderVersion, setRenderVersion] = createSignal(0);

  let canvasRef!: HTMLCanvasElement;
  const renderer = new CanvasRenderer();
  const layout = new CanvasColumnLayout();

  // Ensure cell is visible by adjusting scroll offsets
  function ensureCellVisible(rowIndex: number, colIndex: number) {
    const viewportHeight = canvasHeight() - HEADER_HEIGHT;

    // Vertical
    const rowTop = rowIndex * ROW_HEIGHT;
    const rowBottom = rowTop + ROW_HEIGHT;
    const viewTop = scrollY();
    const viewBottom = viewTop + viewportHeight;

    if (rowTop < viewTop) {
      setScrollY(rowTop);
    } else if (rowBottom > viewBottom) {
      setScrollY(rowBottom - viewportHeight);
    }

    // Horizontal
    const colLeft = layout.getColumnX(colIndex);
    const colRight = colLeft + layout.getColumnWidth(colIndex);
    const viewLeft = scrollX();
    const viewRight = viewLeft + canvasWidth();

    if (colLeft < viewLeft) {
      setScrollX(colLeft);
    } else if (colRight > viewRight) {
      setScrollX(colRight - canvasWidth());
    }
  }

  // Auto-scroll when cursor moves or canvas dimensions change
  createEffect(() => {
    // Subscribe to dimensions so we re-run after mount/resize
    canvasWidth();
    canvasHeight();
    const cell = currentCell();
    if (cell) {
      ensureCellVisible(cell.getRow().index, cell.getColumn().index);
    }
  });

  // Wire up cell/row forceRerender to bump renderVersion
  createEffect(() => {
    const table = getTable();
    const bump = () => setRenderVersion((v) => v + 1);
    for (const row of table.getRows()) {
      row.setForceRerender(bump);
      for (const cell of row.getCells()) {
        cell.setRenderer(bump);
      }
    }
  });

  // Main render effect
  createEffect(() => {
    renderVersion();
    const table = getTable();
    const current = currentCell();
    const selection = visualSelection();
    const sx = scrollX();
    const sy = scrollY();
    const cw = canvasWidth();
    const ch = canvasHeight();

    layout.compute(table);

    renderer.render({
      table,
      currentCell: current,
      visualSelection: selection,
      scrollX: sx,
      scrollY: sy,
      canvasWidth: cw,
      canvasHeight: ch,
      layout,
    });
  });

  function handleResize() {
    const container = tableContainerRef.get();
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    renderer.setupSize({ width, height });

    setCanvasWidth(width);
    setCanvasHeight(height);
  }

  onMount(() => {
    renderer.init(canvasRef);
    handleResize();

    const observer = new ResizeObserver(() => {
      handleResize();
      setRenderVersion((v) => v + 1);
    });

    const container = tableContainerRef.get();

    if (container) observer.observe(container);

    onCleanup(() => observer.disconnect());

    // Kick initial render now that the canvas is initialized and sized
    setRenderVersion((v) => v + 1);

    // Re-render after fonts load for correct text metrics
    document.fonts.ready.then(() => {
      setRenderVersion((v) => v + 1);
    });
  });

  // Popover position computed from cell coords
  const popoverPosition = () => {
    const cell = openedCell();
    if (!cell) return null;
    const colX = layout.getColumnX(cell.getColumn().index) - scrollX();
    const rowY = HEADER_HEIGHT + cell.getRow().index * ROW_HEIGHT - scrollY();
    return { top: rowY + ROW_HEIGHT + 4, left: colX };
  };

  // Dismiss popover when cursor moves
  createWatcher(
    () => currentCell()?.getRow().index,
    () => setOpenedCell(undefined),
  );
  createWatcher(
    () => currentCell()?.getColumn().index,
    () => setOpenedCell(undefined),
  );

  useRegisterKeybindCommandOnMount({
    command: "ReloadTable",
    description: "Reload the current table data.",
    keybindExpression: "r",
    action() {
      props.reload?.();
      message.info("Reloaded table data");
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "SelectionCopyToClipboard",
    description: "Copy the selected cells to the clipboard.",
    keybindExpression: "y",
    action() {
      const values = visualSelection().intersectingCellsToString({
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
    <div
      ref={tableContainerRef.set}
      class="relative overflow-hidden bg-zinc-50"
      style={{ width: "100%", height: "100%" }}
    >
      <canvas ref={canvasRef} class="block" />
      <Show when={openedCell()}>
        {(cell) => {
          const pos = popoverPosition();
          if (!pos) return null;
          return (
            <div
              class="wrap-break-words absolute z-10 max-h-96 max-w-xl overflow-auto rounded-md border border-zinc-200 bg-white p-3 font-mono text-sm text-zinc-700 shadow-lg"
              style={{
                top: `${pos.top}px`,
                left: `${pos.left}px`,
              }}
            >
              {cell().toString()}
            </div>
          );
        }}
      </Show>
    </div>
  );
}
