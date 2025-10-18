import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import { useIntersectionScroll } from "@/lib/useIntersectionScroll";
import type { PostgresDataType } from "@/useTableStructure";
import { useTableEditorContext } from "./TableEditorProvider";

function TableCellDataType(props: {
  data: unknown;
  dataType: PostgresDataType;
  rowIndex: number;
  columnIndex: number;
}) {
  switch (props.dataType) {
    default:
      return <div class={cn("max-w-48 truncate")}>{String(props.data)}</div>;
  }
}

export function TableCell(props: {
  data: unknown;
  dataType: PostgresDataType;
  rowIndex: number;
  columnIndex: number;
  openedCell?: { column: number; row: number };
}) {
  const { column, row } = useTableEditorContext();
  const isActive = () =>
    column() === props.columnIndex && row() === props.rowIndex;
  const ref = useIntersectionScroll<HTMLTableCellElement>(isActive);
  const isOpened = () =>
    props.openedCell?.column === props.columnIndex &&
    props.openedCell.row === props.rowIndex &&
    isActive();

  return (
    <td
      ref={ref}
      class={cn(
        "border border-gray-300 px-2 py-2 text-sm",
        column() === props.columnIndex &&
          row() === props.rowIndex + 1 &&
          "border-b-red-300",
        row() === props.rowIndex &&
          column() === props.columnIndex + 1 &&
          "border-r-red-300",
        isActive() && "border-red-300 bg-red-200",
      )}
    >
      <Popover placement="bottom" open={isOpened()}>
        <PopoverTrigger>
          <TableCellDataType
            columnIndex={props.columnIndex}
            rowIndex={props.rowIndex}
            data={props.data}
            dataType={props.dataType}
          />
        </PopoverTrigger>
        <PopoverContent class="bg-white">{String(props.data)}</PopoverContent>
      </Popover>
    </td>
  );
}
