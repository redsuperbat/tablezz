import { createSignal, onMount, type ParentProps } from "solid-js";
import { createWatcher } from "@/commands/createWatcher";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import { useIntersectionScroll } from "@/lib/useIntersectionScroll";
import type { Cell } from "./Cell";
import { useTableEditorContext } from "./DataTableProvider";

function ConstrainedCell(props: ParentProps) {
  return <div class="h-6 truncate">{props.children}</div>;
}

export function TableCell(props: {
  cell: Cell;
  openedCell?: Cell;
  clearOpenedCell: () => void;
}) {
  const [rerender, forceRerender] = createSignal({});
  const { visualSelection, currentCell } = useTableEditorContext();

  const isCurrent = () => currentCell().equals(props.cell);

  const isActive = () => visualSelection().isIntersectingWith(props.cell);

  const isVisualStart = () => visualSelection().start?.equals(props.cell);

  createWatcher(isCurrent, () => props.clearOpenedCell());

  onMount(() => {
    props.cell.setRenderer(() => forceRerender({}));
  });

  const ref = useIntersectionScroll<HTMLTableCellElement>(isCurrent);

  const isOpened = () => props.cell.equals(props.openedCell) && isCurrent();

  const toString = () => {
    rerender();
    return props.cell.toString();
  };

  const display = () => {
    rerender();
    return props.cell.display();
  };
  const isDirty = () => {
    rerender();
    return props.cell.isDirty;
  };

  return (
    <td
      ref={ref}
      class={cn(
        "border border-gray-300 px-2 py-2 text-sm",
        isActive() && "bg-red-200",
        isCurrent() && "bg-red-300",
        isVisualStart() && "bg-red-100",
        isDirty() && "bg-green-200",
        isDirty() && isCurrent() && "bg-yellow-200",
      )}
    >
      <Popover open={isOpened()}>
        <PopoverTrigger as="div" class="outline-none">
          <ConstrainedCell>{toString()}</ConstrainedCell>
        </PopoverTrigger>
        <PopoverContent class="break-words bg-white">
          {display()}
        </PopoverContent>
      </Popover>
    </td>
  );
}
