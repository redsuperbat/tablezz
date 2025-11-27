import type { ParentProps } from "solid-js";
import { createWatcher } from "@/commands/createWatcher";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import { useIntersectionScroll } from "@/lib/useIntersectionScroll";
import { type Cell, useTableEditorContext } from "./TableEditorProvider";

function ConstrainedCell(props: ParentProps) {
  return <div class="h-6 overflow-scroll">{props.children}</div>;
}

export function TableCell(props: {
  cell: Cell;
  openedCell?: Cell;
  clearOpenedCell: () => void;
}) {
  const { visualBlock, currentCell } = useTableEditorContext();

  const isCurrent = () => currentCell().equals(props.cell);

  const isActive = () => {
    const block = visualBlock();
    return !!block?.isIntersectingWith(props.cell);
  };

  const isVisualStart = () => {
    return visualBlock()?.start.equals(props.cell);
  };

  createWatcher(isCurrent, () => props.clearOpenedCell());

  const ref = useIntersectionScroll<HTMLTableCellElement>(isCurrent);

  const isOpened = () => props.cell.equals(props.openedCell) && isCurrent();

  return (
    <td
      ref={ref}
      class={cn(
        "border border-gray-300 px-2 py-2 text-sm",
        isActive() && "bg-red-200",
        isCurrent() && "bg-red-300",
        isVisualStart() && "bg-red-100",
      )}
    >
      <Popover open={isOpened()}>
        <PopoverTrigger as="div" class="outline-none">
          <ConstrainedCell>{props.cell.getData().display()}</ConstrainedCell>
        </PopoverTrigger>
        <PopoverContent class="break-words bg-white">
          {props.cell.getData().displayExpanded()}
        </PopoverContent>
      </Popover>
    </td>
  );
}
