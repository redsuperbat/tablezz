import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import { useIntersectionScroll } from "@/lib/useIntersectionScroll";
import type { PostgresDataType } from "@/useTableStructure";
import { type Cell, useTableEditorContext } from "./TableEditorProvider";

function JsonCell(props: { cell: Cell; data: unknown }) {
  return (
    <div>
      <pre>
        <code>{JSON.stringify(props.data, null, 2)}</code>
      </pre>
    </div>
  );
}

function TableCellDataType(props: {
  data: unknown;
  dataType: PostgresDataType;
  cell: Cell;
}) {
  switch (props.dataType) {
    case "json":
    case "jsonb":
      return <JsonCell cell={props.cell} data={props.data} />;

    default:
      return <div class={cn("max-w-48 truncate")}>{String(props.data)}</div>;
  }
}

export function TableCell(props: {
  data: unknown;
  dataType: PostgresDataType;
  cell: Cell;
  openedCell?: Cell;
}) {
  const { visualBlock, currentCell } = useTableEditorContext();

  const isCurrent = () => currentCell().equals(props.cell);

  const isActive = () => {
    const block = visualBlock();
    return !!block?.isIntersectingWith(props.cell);
  };
  const isVisualStart = () => visualBlock()?.start.equals(props.cell);

  const ref = useIntersectionScroll<HTMLTableCellElement>(isCurrent);

  const isOpened = () => props.cell.equals(props.openedCell) && isCurrent();
  const isHeaderRow = () => props.cell.row === 0;

  return (
    <td
      ref={ref}
      class={cn(
        "border border-gray-300 px-2 py-2 text-sm",
        isHeaderRow() && "font-bold",
        isActive() && "bg-red-200",
        isCurrent() && "bg-red-300",
        isVisualStart() && "bg-red-100",
      )}
    >
      <Popover placement="bottom" open={isOpened()}>
        <PopoverTrigger>
          <TableCellDataType
            cell={props.cell}
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
