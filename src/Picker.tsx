import type { FuzzyMatches, FuzzyResult } from "@nozbe/microfuzz";
import createFuzzySearch from "@nozbe/microfuzz";
import { Folder, Table } from "lucide-solid";
import { createMemo, For, type JSXElement } from "solid-js";
import z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createWatcher } from "./commands/createWatcher";
import { useAppForm } from "./components/form";
import { useRegisterKeybindCommandOnMount } from "./keybinds/useRegisterKeybindCommand";
import { useRegisterKeybindValue } from "./keybinds/useRegisterKeybindValue";
import { cn } from "./lib/cn";
import { createCounterWithWrap } from "./lib/counter";
import { useIntersectionScroll } from "./lib/useIntersectionScroll";
import { useSchemaContext } from "./SchemaProvider";
import { useSelectedTableContext } from "./SelectedTableProvider";
import { useSelectedDatabaseSchemas } from "./useSelectedDatabaseSchemas";
import { useSelectedSchemaTables } from "./useSelectedSchemaTables";

interface PickerItem {
  icon: JSXElement;
  onSelect(): void;
  searchTerm: string;
}

export function Picker() {
  const { setSelectedTable } = useSelectedTableContext();
  const selectedSchema = useSelectedSchemaTables();
  const selectedSchemas = useSelectedDatabaseSchemas();
  const { setSchema } = useSchemaContext();

  const pickerType = useRegisterKeybindValue({
    command: "PickerOpen",
    description: "Open the picker to pick items",
    keybindExpression: "Leader > Space",
    actionArgs: [
      z.enum(["schemas", "tables"]).default("tables").meta({ title: "<type>" }),
    ],
  });

  const tables = () => selectedSchema.data ?? [];

  const schemas = () => selectedSchemas.data ?? [];

  const items = (): PickerItem[] => {
    const type = pickerType.value();
    if (!type) return [];

    switch (type[0]) {
      case "schemas":
        return schemas().map((s) => ({
          icon: <Folder />,
          searchTerm: s.schemaName,
          onSelect() {
            setSchema(s.schemaName);
          },
        }));

      case "tables":
        return tables().map((t) => ({
          icon: <Table />,
          searchTerm: t.tableName,
          onSelect() {
            setSelectedTable(t.tableName);
          },
        }));
    }
  };

  return (
    <Dialog modal open={!!pickerType.value()}>
      <DialogContent
        onEscapeKeyDown={(e) => e.preventDefault()}
        class="flex flex-col justify-start overflow-hidden rounded-none border border-zinc-200 bg-zinc-50 p-0 shadow-2xl"
        aria-describedby="Command palette"
      >
        <PickerContent
          onSelect={() => pickerType.set(undefined)}
          items={items()}
        />
      </DialogContent>
    </Dialog>
  );
}

function PickerContent(props: { items: PickerItem[]; onSelect: () => void }) {
  const form = useAppForm(() => ({
    defaultValues: { searchTerm: "" },
  }));

  useRegisterKeybindCommandOnMount({
    command: "PickerClose",
    description: "Close the picker dialog.",
    action: props.onSelect,
    keybindExpression: "Escape",
    overrideInput: true,
  });

  const searchTerm = form.useStore((store) => store.values.searchTerm);

  const filteredItems = (): FuzzyResult<PickerItem>[] => {
    const term = searchTerm();

    if (!term) {
      return props.items.map((i) => ({ item: i, matches: [], score: 0 }));
    }

    const search = createFuzzySearch<PickerItem>(props.items, {
      key: "searchTerm",
    });

    const result = search(term);
    return result;
  };

  const selectedIndex = createCounterWithWrap(() => filteredItems().length - 1);

  // we want to reset the selected index when the search term changes
  createWatcher(searchTerm, selectedIndex.reset);

  useRegisterKeybindCommandOnMount({
    command: "PickerSelect",
    description: "Select the highlighted item in the picker.",
    action() {
      const item = filteredItems()[selectedIndex.value()];
      item?.item.onSelect?.();
      props.onSelect();
      form.reset();
    },
    keybindExpression: "Enter",
    overrideInput: true,
  });

  useRegisterKeybindCommandOnMount({
    command: "PickerSelectPrev",
    description: "Move to the previous item in the picker.",
    keybindExpression: "(Control + k) | ArrowUp",
    overrideInput: true,
    action() {
      selectedIndex.decrement();
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "PickerSelectNext",
    description: "Move to the next item in the picker.",
    keybindExpression: "(Control + j) | ArrowDown",
    overrideInput: true,
    action() {
      selectedIndex.increment();
    },
  });

  return (
    <>
      <DialogHeader class="border-b border-zinc-200 bg-white p-3">
        <DialogTitle class="sr-only">Command palette</DialogTitle>
        <form
          class="flex min-w-sm flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <form.AppField
            name="searchTerm"
            children={(field) => (
              <field.TextField type="text" placeholder="Type something..." />
            )}
          />
        </form>
      </DialogHeader>
      <div class="flex h-80 flex-col overflow-y-auto bg-white p-1">
        <For each={filteredItems()}>
          {(result, i) => (
            <SearchItem
              index={i()}
              item={result.item}
              selectedIndex={selectedIndex.value()}
              highlightRanges={result.matches}
            />
          )}
        </For>
      </div>
    </>
  );
}

function SearchItem(props: {
  selectedIndex: number;
  index: number;
  item: PickerItem;
  highlightRanges: FuzzyMatches;
}) {
  const isActive = createMemo(() => props.selectedIndex === props.index);
  const ref = useIntersectionScroll(isActive);

  return (
    <div
      ref={ref}
      class={cn(
        "flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-700 transition-colors",
        isActive() && "bg-blue-500/20 text-zinc-900",
      )}
    >
      <span
        class={cn(
          "flex size-4 shrink-0 items-center justify-center text-zinc-400",
          isActive() && "text-blue-600",
        )}
      >
        {props.item.icon}
      </span>
      <span class="font-mono">{props.item.searchTerm}</span>
    </div>
  );
}
