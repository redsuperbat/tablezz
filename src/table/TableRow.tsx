import { For } from "solid-js";
import type { PostgresDataType } from "@/useTableStructure";
import { TableCell } from "./TableCell";

export function TableRow<
  T extends Record<string, unknown>,
  K extends keyof T,
>(props: {
  row: T;
  rowIndex: number;
  structure: { columnName: K; dataType: PostgresDataType }[];
}) {
  return (
    <tr>
      <For each={props.structure}>
        {(s, index) => (
          <TableCell
            columnIndex={index()}
            rowIndex={props.rowIndex}
            dataType={s.dataType}
            data={props.row[s.columnName]}
          />
        )}
      </For>
    </tr>
  );
}
