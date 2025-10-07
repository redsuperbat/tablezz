import { For } from "solid-js";
import type { PostgresDataType } from "@/useTableStructure";
import { TableCell } from "./TableCell";

export function TableRow<T extends Record<string, unknown>, K extends keyof T>({
  rowIndex,
  row,
  structure,
}: {
  row: T;
  rowIndex: number;
  structure: { columnName: K; dataType: PostgresDataType }[];
}) {
  return (
    <tr>
      <For each={structure}>
        {(s, index) => (
          <TableCell
            columnIndex={index()}
            rowIndex={rowIndex}
            dataType={s.dataType}
            data={row[s.columnName]}
          />
        )}
      </For>
    </tr>
  );
}
