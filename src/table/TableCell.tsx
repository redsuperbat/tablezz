import { cn } from "@/lib/utils";
import type { PostgresDataType } from "@/useTableStructure";
import { useTableEditorContext } from "./TableEditorProvider";

function TableCellDataType({
  data,
  dataType,
}: {
  data: unknown;
  dataType: PostgresDataType;
  rowIndex: number;
  columnIndex: number;
}) {
  switch (dataType) {
    default:
      return <div className={cn("truncate max-w-48")}>{String(data)}</div>;
  }
}

export function TableCell({
  data,
  dataType,
  columnIndex,
  rowIndex,
}: {
  data: unknown;
  dataType: PostgresDataType;
  rowIndex: number;
  columnIndex: number;
}) {
  const { column, row } = useTableEditorContext();
  return (
    <td
      className={cn(
        "border text-sm border-gray-300 py-2 px-2",
        column === columnIndex && row === rowIndex + 1 && "border-b-red-300",
        row === rowIndex && column === columnIndex + 1 && "border-r-red-300",
        column === columnIndex &&
          row === rowIndex &&
          "border-red-300 bg-red-200",
      )}
    >
      <TableCellDataType
        columnIndex={columnIndex}
        rowIndex={rowIndex}
        data={data}
        dataType={dataType}
      />
    </td>
  );
}
