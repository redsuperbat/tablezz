import type { Cell } from "../Cell";
import type { Column } from "../Column";
import type { Table } from "../Table";
import type { VisualSelection } from "../VisualSelection";
import type { CanvasColumnLayout } from "./CanvasColumnLayout";
import { drawIcon, ICON_KEY, ICON_LINK2 } from "./icons";

export const ROW_HEIGHT = 37;
export const HEADER_HEIGHT = 37;
const CELL_PADDING_X = 12;
const ICON_SIZE = 14;
const ICON_GAP = 4;

const COLORS = {
  white: "#ffffff",
  bg: "#fafafa", // zinc-50
  border: "#e4e4e7", // zinc-200
  cellText: "#3f3f46", // zinc-700
  headerText: "#52525b", // zinc-600
  currentBg: "rgba(59, 130, 246, 0.2)",
  currentOutline: "#3b82f6",
  selectionBg: "rgba(99, 102, 241, 0.15)",
  selectionStartBg: "rgba(99, 102, 241, 0.25)",
  dirtyBg: "rgba(245, 158, 11, 0.2)",
  dirtyActiveBg: "rgba(245, 158, 11, 0.1)",
  dirtyCurrentBg: "rgba(245, 158, 11, 0.3)",
  dirtyCurrentOutline: "#f59e0b",
  deletedBg: "rgba(239, 68, 68, 0.1)",
  deletedText: "#71717a",
  pkColor: "#f59e0b", // amber-500
  fkColor: "#3b82f6", // blue-500
  iconColor: "#a1a1aa", // zinc-400
  nullableColor: "#60a5fa", // blue-400
};

export interface RenderState {
  table: Table;
  currentCell: Cell | undefined;
  visualSelection: VisualSelection;
  scrollX: number;
  scrollY: number;
  canvasWidth: number;
  canvasHeight: number;
  layout: CanvasColumnLayout;
}

export class CanvasRenderer {
  #canvas?: HTMLCanvasElement;
  #ctx?: CanvasRenderingContext2D;

  init(canvas: HTMLCanvasElement): void {
    this.#canvas = canvas;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("No 2D context found");
    }

    this.#ctx = context;
  }

  #withContext(fn: (ctx: CanvasRenderingContext2D) => void) {
    if (!this.#ctx) {
      throw new Error("No 2D context found");
    }
    fn(this.#ctx);
  }

  setupSize({ width, height }: { width: number; height: number }): void {
    const canvas = this.#canvas;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    this.#withContext((ctx) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    });
  }

  render(state: RenderState): void {
    if (!this.#ctx) return;
    this.#withContext((ctx) => {
      const {
        table,
        currentCell,
        visualSelection,
        scrollX,
        scrollY,
        canvasWidth,
        canvasHeight,
        layout,
      } = state;
      const rows = table.getRows();
      const columns = table.getColumns();

      if (columns.length === 0 || canvasWidth === 0 || canvasHeight === 0)
        return;

      // Clear
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Visible range
      const viewportHeight = canvasHeight - HEADER_HEIGHT;
      const startRow = Math.max(0, Math.floor(scrollY / ROW_HEIGHT));
      const endRow = Math.min(
        rows.length - 1,
        Math.ceil((scrollY + viewportHeight) / ROW_HEIGHT),
      );

      const startCol = this.#findFirstVisibleCol({
        scrollX,
        layout,
        colCount: columns.length,
      });
      const endCol = this.#findLastVisibleCol({
        scrollX,
        canvasWidth,
        layout,
        colCount: columns.length,
      });

      // Draw cell backgrounds
      for (let r = startRow; r <= endRow; r++) {
        const row = rows[r];
        if (!row) continue;
        const cellY = HEADER_HEIGHT + r * ROW_HEIGHT - scrollY;

        for (let c = startCol; c <= endCol; c++) {
          const cell = row.getCell(c);
          if (!cell) continue;
          const cellX = layout.getColumnX(c) - scrollX;
          const cellW = layout.getColumnWidth(c);

          // White base
          ctx.fillStyle = COLORS.white;
          ctx.fillRect(cellX, cellY, cellW, ROW_HEIGHT);

          // Deleted row
          if (row.isDeleted) {
            ctx.fillStyle = COLORS.deletedBg;
            ctx.fillRect(cellX, cellY, cellW, ROW_HEIGHT);
          }

          // State overlays
          const bg = this.#cellBgColor({ cell, currentCell, visualSelection });
          if (bg) {
            ctx.fillStyle = bg;
            ctx.fillRect(cellX, cellY, cellW, ROW_HEIGHT);
          }
        }
      }

      // Draw cell text
      ctx.textBaseline = "middle";
      for (let r = startRow; r <= endRow; r++) {
        const row = rows[r];
        if (!row) continue;
        const cellY = HEADER_HEIGHT + r * ROW_HEIGHT - scrollY;

        for (let c = startCol; c <= endCol; c++) {
          const cell = row.getCell(c);
          if (!cell) continue;
          const cellX = layout.getColumnX(c) - scrollX;
          const cellW = layout.getColumnWidth(c);

          const text = cell.toString();
          ctx.save();
          ctx.beginPath();
          ctx.rect(cellX, cellY, cellW, ROW_HEIGHT);
          ctx.clip();

          ctx.font = "13px monospace";
          ctx.fillStyle = COLORS.cellText;
          ctx.fillText(text, cellX + CELL_PADDING_X, cellY + ROW_HEIGHT / 2);

          // Strikethrough for deleted rows
          if (row.isDeleted) {
            const textWidth = ctx.measureText(text).width;
            ctx.strokeStyle = COLORS.deletedText;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cellX + CELL_PADDING_X, cellY + ROW_HEIGHT / 2);
            ctx.lineTo(
              cellX + CELL_PADDING_X + textWidth,
              cellY + ROW_HEIGHT / 2,
            );
            ctx.stroke();
          }

          ctx.restore();
        }
      }

      // Draw grid lines
      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = 1;

      // Horizontal lines
      for (let r = startRow; r <= endRow + 1; r++) {
        const y = Math.round(HEADER_HEIGHT + r * ROW_HEIGHT - scrollY) + 0.5;
        if (y < HEADER_HEIGHT || y > canvasHeight) continue;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
        ctx.stroke();
      }

      // Vertical lines
      for (let c = startCol; c <= endCol + 1; c++) {
        const x = Math.round(layout.getColumnX(c) - scrollX) + 0.5;
        if (x < 0 || x > canvasWidth) continue;
        ctx.beginPath();
        ctx.moveTo(x, HEADER_HEIGHT);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
      }

      // Current cell outline
      if (currentCell) {
        const r = currentCell.getRow().index;
        const c = currentCell.getColumn().index;
        const cellX = layout.getColumnX(c) - scrollX;
        const cellY = HEADER_HEIGHT + r * ROW_HEIGHT - scrollY;
        const cellW = layout.getColumnWidth(c);

        const isDirty = currentCell.isDirty;
        ctx.strokeStyle = isDirty
          ? COLORS.dirtyCurrentOutline
          : COLORS.currentOutline;
        ctx.lineWidth = 1;
        ctx.strokeRect(cellX + 0.5, cellY + 0.5, cellW - 1, ROW_HEIGHT - 1);
      }

      // Sticky header background
      ctx.fillStyle = COLORS.white;
      ctx.fillRect(0, 0, canvasWidth, HEADER_HEIGHT);

      // Header bottom border
      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, HEADER_HEIGHT + 0.5);
      ctx.lineTo(canvasWidth, HEADER_HEIGHT + 0.5);
      ctx.stroke();

      // Header cells
      for (let c = startCol; c <= endCol; c++) {
        const col = columns[c];
        if (!col) continue;
        const cellX = layout.getColumnX(c) - scrollX;
        const cellW = layout.getColumnWidth(c);
        this.#drawColumnHeader({
          column: col,
          x: cellX,
          y: 0,
          width: cellW,
          height: HEADER_HEIGHT,
        });
      }
    });
  }

  #drawColumnHeader({
    column,
    x,
    y,
    width,
    height,
  }: {
    column: Column;
    x: number;
    y: number;
    width: number;
    height: number;
  }): void {
    this.#withContext((ctx) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, width, height);
      ctx.clip();

      let cursorX = x + CELL_PADDING_X;
      const iconY = y + (height - ICON_SIZE) / 2;

      if (column.isPrimary) {
        drawIcon({
          ctx,
          icon: ICON_KEY,
          x: cursorX,
          y: iconY,
          size: ICON_SIZE,
          color: COLORS.pkColor,
        });
        cursorX += ICON_SIZE + ICON_GAP;
      }

      if (column.foreignKey) {
        drawIcon({
          ctx,
          icon: ICON_LINK2,
          x: cursorX,
          y: iconY,
          size: ICON_SIZE,
          color: COLORS.fkColor,
        });
        cursorX += ICON_SIZE + ICON_GAP;
      }

      const dataTypeIcon = column.getDataType().iconDef();
      if (dataTypeIcon) {
        drawIcon({
          ctx,
          icon: dataTypeIcon,
          x: cursorX,
          y: iconY,
          size: ICON_SIZE,
          color: COLORS.iconColor,
        });
        cursorX += ICON_SIZE + ICON_GAP;
      }

      const centerY = y + height / 2;
      ctx.textBaseline = "middle";

      ctx.fillStyle = COLORS.headerText;
      ctx.font = "500 14px system-ui, sans-serif";
      ctx.fillText(column.name, cursorX, centerY);
      cursorX += ctx.measureText(column.name).width + 4;

      if (column.isNullable) {
        ctx.fillStyle = COLORS.nullableColor;
        ctx.font = "bold 11px system-ui, sans-serif";
        ctx.fillText("?", cursorX, centerY);
      }

      ctx.restore();
    });
  }

  #cellBgColor({
    cell,
    currentCell,
    visualSelection,
  }: {
    cell: Cell;
    currentCell: Cell | undefined;
    visualSelection: VisualSelection;
  }): string | undefined {
    const isCurrent = !!currentCell?.equals(cell);
    const isActive = visualSelection.isIntersectingWithCell(cell);
    const isVisualStart = !!visualSelection.start?.equals(cell);
    const isDirty = cell.isDirty;

    if (isDirty && isCurrent) return COLORS.dirtyCurrentBg;
    if (isDirty && isActive) return COLORS.dirtyActiveBg;
    if (isDirty) return COLORS.dirtyBg;
    if (isCurrent) return COLORS.currentBg;
    if (isVisualStart) return COLORS.selectionStartBg;
    if (isActive) return COLORS.selectionBg;
    return undefined;
  }

  #findFirstVisibleCol({
    scrollX,
    layout,
    colCount,
  }: {
    scrollX: number;
    layout: CanvasColumnLayout;
    colCount: number;
  }): number {
    for (let c = 0; c < colCount; c++) {
      if (layout.getColumnX(c) + layout.getColumnWidth(c) > scrollX) return c;
    }
    return 0;
  }

  #findLastVisibleCol({
    scrollX,
    canvasWidth,
    layout,
    colCount,
  }: {
    scrollX: number;
    canvasWidth: number;
    layout: CanvasColumnLayout;
    colCount: number;
  }): number {
    for (let c = colCount - 1; c >= 0; c--) {
      if (layout.getColumnX(c) < scrollX + canvasWidth) return c;
    }
    return colCount - 1;
  }
}
