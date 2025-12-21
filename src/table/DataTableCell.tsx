import { createSignal, onMount, type ParentProps } from "solid-js";
import { createWatcher } from "@/commands/createWatcher";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import { useHorizontalScrollIntoView } from "@/lib/useHorizontalScrollIntoView";
import type { Cell } from "./Cell";
import { useTableEditorContext } from "./DataTableProvider";

function ConstrainedCell(props: ParentProps) {
  return (
    <div class="h-5 max-w-xl truncate font-mono text-zinc-700">
      {props.children}
    </div>
  );
}

export function TableCell(props: {
  cell: Cell;
  openedCell?: Cell;
  clearOpenedCell: () => void;
}) {
  const [rerender, forceRerender] = createSignal({});
  const { visualSelection, currentCell, tableContainerRef } =
    useTableEditorContext();

  const isCurrent = () => !!currentCell()?.equals(props.cell);

  const isActive = () => visualSelection().isIntersectingWithCell(props.cell);

  const isVisualStart = () => visualSelection().start?.equals(props.cell);

  createWatcher(isCurrent, () => props.clearOpenedCell());

  const ref = useHorizontalScrollIntoView(isCurrent, tableContainerRef.get);

  onMount(() => {
    props.cell.setRenderer(() => forceRerender({}));
  });

  const isOpened = () => props.cell.equals(props.openedCell) && isCurrent();

  const cellToString = () => {
    rerender();
    return props.cell.cellRender();
  };

  const displayCell = () => {
    rerender();
    return props.cell.toString();
  };

  const isDirty = () => {
    rerender();
    return props.cell.isDirty;
  };

  return (
    <div
      ref={ref}
      class={cn(
        "scroll-mt-12 border-zinc-200 border-t border-l px-3 py-1.5 text-sm last:border-r",
        isActive() && "bg-indigo-500/15",
        isCurrent() &&
          "-outline-offset-1 bg-blue-500/20 outline-1 outline-blue-500",
        isVisualStart() && "bg-indigo-500/25",
        isDirty() && "bg-amber-500/20",
        isDirty() && isActive() && "bg-amber-500/10",
        isDirty() &&
          isCurrent() &&
          "-outline-offset-1 bg-amber-500/30 outline-1 outline-amber-500",
      )}
    >
      <Popover open={isOpened()}>
        <PopoverTrigger as="div" class="outline-none">
          <ConstrainedCell>{cellToString()}</ConstrainedCell>
        </PopoverTrigger>
        <PopoverContent class="wrap-break-word w-full max-w-6xl rounded-md border border-zinc-200 bg-white p-3 font-mono text-sm text-zinc-700 shadow-lg">
          {displayCell()}
        </PopoverContent>
      </Popover>
    </div>
  );
}
