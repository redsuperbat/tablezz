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
    <tr key={JSON.stringify(row)}>
      {structure.map((s, index) => (
        <TableCell
          columnIndex={index}
          rowIndex={rowIndex}
          key={s.columnName as string}
          dataType={s.dataType}
          data={row[s.columnName]}
        />
      ))}
    </tr>
  );
}
