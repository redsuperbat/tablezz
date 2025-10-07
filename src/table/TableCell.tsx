import { cn } from "@/lib/cn";
import { useIntersectionScroll } from "@/lib/useIntersectionScroll";
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
      return <div class={cn("truncate max-w-48")}>{String(data)}</div>;
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
  const isActive = column === columnIndex && row === rowIndex;
  const { ref } = useIntersectionScroll<HTMLTableCellElement>(isActive);

  return (
    <td
      ref={ref}
      class={cn(
        "border text-sm border-gray-300 py-2 px-2",
        column === columnIndex && row === rowIndex + 1 && "border-b-red-300",
        row === rowIndex && column === columnIndex + 1 && "border-r-red-300",
        isActive && "border-red-300 bg-red-200",
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
