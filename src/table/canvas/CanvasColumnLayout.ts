import { measureNaturalWidth, prepareWithSegments } from "@chenglou/pretext";
import type { Table } from "../Table";

const MIN_COLUMN_WIDTH = 80;
const MAX_COLUMN_WIDTH = 500;
const CELL_PADDING_X = 12;
const CELL_FONT = "13px monospace";
const HEADER_FONT = "500 14px system-ui, sans-serif";
const SAMPLE_ROWS = 50;
// Extra header space for icons (PK, FK, datatype) + nullable indicator
const HEADER_ICON_SPACE = 20;

export class CanvasColumnLayout {
  #columnWidths: number[] = [];
  #columnXPositions: number[] = [];
  #totalWidth = 0;

  compute(table: Table): void {
    const columns = table.getColumns();
    const rows = table.getRows();

    this.#columnWidths = columns.map((col) => {
      // Measure header text width
      const headerPrepared = prepareWithSegments(col.name, HEADER_FONT);
      let headerWidth = measureNaturalWidth(headerPrepared);

      // Add space for icons in header
      let iconCount = 0;
      if (col.isPrimary) iconCount++;
      if (col.foreignKey) iconCount++;

      if (col.getDataType().iconDef()) iconCount++;

      headerWidth += iconCount * HEADER_ICON_SPACE;

      if (col.isNullable) headerWidth += 12;

      // Measure cell content width (sample first N rows)
      let maxCellWidth = 0;
      const sampleCount = Math.min(rows.length, SAMPLE_ROWS);
      for (let r = 0; r < sampleCount; r++) {
        const cell = rows[r]?.getCell(col.index);
        if (!cell) continue;

        const text = cell.toString();
        if (text.length === 0) continue;

        // Truncate very long strings before measuring
        const measureText = text.length > 80 ? text.slice(0, 80) : text;
        const prepared = prepareWithSegments(measureText, CELL_FONT);
        const width = measureNaturalWidth(prepared);

        if (width > maxCellWidth) maxCellWidth = width;
      }

      const contentWidth =
        Math.max(headerWidth, maxCellWidth) + CELL_PADDING_X * 2;

      return Math.min(
        MAX_COLUMN_WIDTH,
        Math.max(MIN_COLUMN_WIDTH, contentWidth),
      );
    });

    this.#columnXPositions = [];
    let x = 0;
    for (const w of this.#columnWidths) {
      this.#columnXPositions.push(x);
      x += w;
    }
    this.#totalWidth = x;
  }

  getColumnX(index: number): number {
    return this.#columnXPositions[index] ?? 0;
  }

  getColumnWidth(index: number): number {
    return this.#columnWidths[index] ?? MIN_COLUMN_WIDTH;
  }

  get totalWidth(): number {
    return this.#totalWidth;
  }

  get columnWidths(): number[] {
    return this.#columnWidths;
  }

  get columnXPositions(): number[] {
    return this.#columnXPositions;
  }
}
