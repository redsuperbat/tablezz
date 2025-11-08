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
  const { column, row, visualModePoint } = useTableEditorContext();
  const isActive = () => {
    const point = visualModePoint();
    if (point) {
    }

    return column() === props.columnIndex && row() === props.rowIndex;
  };

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
        isActive() && "bg-red-200",
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
        <PopoverContent class="break-words bg-white">
          {String(props.data)}
        </PopoverContent>
      </Popover>
    </td>
  );
}
