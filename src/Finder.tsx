import createFuzzySearch, { type FuzzyMatches } from "@nozbe/microfuzz";
import { Folder, Route, Table } from "lucide-solid";
import { createEffect, createSignal, For, type JSXElement } from "solid-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TextField } from "./components/ui/textfield";
import { useRegisterKeybindCommand } from "./keybinds/useRegisterKeybindCommand";
import { useRegisterKeybindToggle } from "./keybinds/useRegisterToggleKeybind";
import { cn } from "./lib/cn";
import { useIntersectionScroll } from "./lib/useIntersectionScroll";
import { useWrapWithZero } from "./lib/useWrapWithZero";
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

export function Finder() {
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
        class="flex flex-col justify-start"
        aria-describedby="Command palette"
      >
        <FinderContent onSelect={() => toggle.set(false)} items={items()} />
      </DialogContent>
    </Dialog>
  );
}

function FinderContent({
  items,
  onSelect,
}: {
  items: FinderItem[];
  onSelect: () => void;
}) {
  const [searchTerm, setSearchTerm] = createSignal("");

  const fuzzySearch = () => createFuzzySearch(items);

  const filteredItems = () => fuzzySearch()(searchTerm());

  const selectedIndex = useWrapWithZero(() => filteredItems().length - 1);

  createEffect(() => {
    searchTerm();
    selectedIndex.reset();
  });

  useRegisterKeybindCommand({
    command: "FinderSelect",
    action() {
      filteredItems()[selectedIndex.value()]?.item.onSelect?.();
      onSelect();
      setSearchTerm("");
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
        <TextField
          placeholder="Type something..."
          autofocus
          value={searchTerm()}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </DialogHeader>
      <div class="flex flex-col h-80 overflow-y-auto">
        <For each={filteredItems()}>
          {({ item, matches }, i) => (
            <SearchItem
              index={i()}
              item={item}
              selectedIndex={selectedIndex.value()}
              highlightRanges={matches}
            />
          )}
        </For>
      </div>
    </>
  );
}

function SearchItem({
  selectedIndex,
  item,
  index,
}: {
  selectedIndex: number;
  index: number;
  item: FinderItem;
  highlightRanges: FuzzyMatches;
}) {
  const isActive = selectedIndex === index;
  const { ref } = useIntersectionScroll(isActive);

  return (
    <div
      ref={ref}
      class={cn(isActive && "bg-gray-100", "p-1 rounded flex gap-1")}
    >
      <span>{item.icon}</span>
      <div>{item.searchTerm}</div>
    </div>
  );
}
