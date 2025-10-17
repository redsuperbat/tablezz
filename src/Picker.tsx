import type { FuzzyMatches, FuzzyResult } from "@nozbe/microfuzz";
import createFuzzySearch from "@nozbe/microfuzz";
import { Folder, Route, Table } from "lucide-solid";
import { createEffect, createMemo, For, type JSXElement } from "solid-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppForm } from "./components/form";
import { useRegisterKeybindCommand } from "./keybinds/useRegisterKeybindCommand";
import { useRegisterKeybindToggle } from "./keybinds/useRegisterToggleKeybind";
import { cn } from "./lib/cn";
import { useIntersectionScroll } from "./lib/useIntersectionScroll";
import { createCounterWithWrap } from "./lib/useWrapWithZero";
import { useRouter } from "./Router";
import { useSchemaContext } from "./SchemaProvider";
import { useSelectedTableContext } from "./SelectedTableProvider";
import { useSelectedDatabaseSchemas } from "./useSelectedDatabaseSchemas";
import { useSelectedSchemaTables } from "./useSelectedSchemaTables";

interface FinderItem {
  icon: JSXElement;
  onSelect(): void;
  searchTerm: string;
}

export function Picker() {
  const { setSelectedTable } = useSelectedTableContext();
  const { routes, navigateTo } = useRouter();
  const selectedSchema = useSelectedSchemaTables();
  const selectedSchemas = useSelectedDatabaseSchemas();
  const { setSchema } = useSchemaContext();

  const tables = () => selectedSchema.data ?? [];

  const schemas = () => selectedSchemas.data ?? [];

  const items = (): FinderItem[] => {
    return [
      ...tables().map((t) => ({
        icon: <Table />,
        searchTerm: t.tableName,
        onSelect() {
          setSelectedTable(t.tableName);
        },
      })),
      ...schemas().map((s) => ({
        icon: <Folder />,
        searchTerm: s.schemaName,
        onSelect() {
          setSchema(s.schemaName);
        },
      })),
      ...routes.map((r) => ({
        icon: <Route />,
        searchTerm: r,
        onSelect() {
          navigateTo(r);
        },
      })),
    ];
  };

  const toggle = useRegisterKeybindToggle({
    command: "FinderOpen",
    keybindExpression: "Leader + Space",
  });

  return (
    <Dialog modal open={toggle.value()} onOpenChange={toggle.set}>
      <DialogContent
        onEscapeKeyDown={(e) => e.preventDefault()}
        class="flex flex-col justify-start bg-white"
        aria-describedby="Command palette"
      >
        <PickerContent onSelect={() => toggle.set(false)} items={items()} />
      </DialogContent>
    </Dialog>
  );
}

function PickerContent(props: { items: FinderItem[]; onSelect: () => void }) {
  const form = useAppForm(() => ({
    defaultValues: { searchTerm: "" },
  }));

  useRegisterKeybindCommand({
    command: "PickerClose",
    action: props.onSelect,
    keybindExpression: "Escape",
    overrideInput: true,
  });

  const searchTerm = form.useStore((store) => store.values.searchTerm);

  const filteredItems = (): FuzzyResult<FinderItem>[] => {
    const term = searchTerm();

    if (!term) {
      return props.items.map((i) => ({ item: i, matches: [], score: 0 }));
    }

    const search = createFuzzySearch<FinderItem>(props.items, {
      key: "searchTerm",
    });

    const result = search(term);
    return result;
  };

  const selectedIndex = createCounterWithWrap(() => filteredItems().length - 1);

  createEffect(() => {
    searchTerm();
    selectedIndex.reset();
  });

  useRegisterKeybindCommand({
    command: "FinderSelect",
    action() {
      const item = filteredItems()[selectedIndex.value()];
      item?.item.onSelect?.();
      props.onSelect();
      form.reset();
    },
    keybindExpression: "Enter",
    overrideInput: true,
  });

  useRegisterKeybindCommand({
    command: "FinderSelectPrev",
    keybindExpression: "(Control + k) | ArrowUp",
    overrideInput: true,
    action() {
      selectedIndex.decrement();
    },
  });

  useRegisterKeybindCommand({
    command: "FinderSelectNext",
    keybindExpression: "(Control + j) | ArrowDown",
    overrideInput: true,
    action() {
      selectedIndex.increment();
    },
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle class="sr-only">Command palette</DialogTitle>
        <form
          class="flex min-w-sm flex-col gap-1"
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
      <div class="flex h-80 flex-col overflow-y-auto">
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
  item: FinderItem;
  highlightRanges: FuzzyMatches;
}) {
  const isActive = createMemo(() => props.selectedIndex === props.index);
  const ref = useIntersectionScroll(isActive);

  return (
    <div
      ref={ref}
      class={cn(isActive() && "bg-gray-100", "flex gap-1 rounded p-1")}
    >
      <span>{props.item.icon}</span>
      <div>{props.item.searchTerm}</div>
    </div>
  );
}
