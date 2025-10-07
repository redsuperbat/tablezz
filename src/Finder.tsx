import { Highlight, useFuzzySearchList } from "@nozbe/microfuzz/react";
import { Folder, Route, Table } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "./components/ui/input";
import { useRegisterKeybindCommand } from "./keybinds/useRegisterKeybindCommand";
import { useRegisterKeybindToggle } from "./keybinds/useRegisterToggleKeybind";
import { useIntersectionScroll } from "./lib/useIntersectionScroll";
import { useWrapWithZero } from "./lib/useWrapWithZero";
import { cn } from "./lib/utils";
import { useRouter } from "./Router";
import { useSchemaContext } from "./SchemaProvider";
import { useSelectedTableContext } from "./SelectedTableProvider";
import { useSelectedDatabaseSchemas } from "./useSelectedDatabaseSchemas";
import { useSelectedSchemaTables } from "./useSelectedSchemaTables";

interface FinderItem {
  icon: ReactNode;
  onSelect(): void;
  searchTerm: string;
}

export function Finder() {
  const { setSelectedTable } = useSelectedTableContext();
  const { routes, navigateTo } = useRouter();
  const selectedSchema = useSelectedSchemaTables();
  const selectedSchemas = useSelectedDatabaseSchemas();
  const { setSchema } = useSchemaContext();

  const tables = useMemo(() => selectedSchema.data ?? [], [selectedSchema]);

  const schemas = useMemo(() => selectedSchemas.data ?? [], [selectedSchemas]);

  const items = useMemo((): FinderItem[] => {
    return [
      ...tables.map((t) => ({
        icon: <Table />,
        searchTerm: t.tableName,
        onSelect() {
          setSelectedTable(t.tableName);
        },
      })),
      ...schemas.map((s) => ({
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
  }, [tables, routes, setSelectedTable, navigateTo, schemas, setSchema]);

  const toggle = useRegisterKeybindToggle({
    command: "FinderOpen",
    keybindExpression: "Leader + Space",
  });

  return (
    <Dialog modal open={toggle.value} onOpenChange={toggle.set}>
      <DialogContent
        forceMount
        class="flex flex-col justify-start"
        showCloseButton={false}
        aria-describedby="Command palette"
      >
        <FinderContent onSelect={() => toggle.set(false)} items={items} />
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
  const [searchTerm, setSearchTerm] = useState("");
  const filteredItems = useFuzzySearchList({
    list: items,
    getText: (i) => [i.searchTerm],
    queryText: searchTerm,
    mapResultItem: (r) => ({
      item: r.item,
      highlightRanges: r.matches.at(0) ?? null,
    }),
  });

  const selectedIndex = useWrapWithZero(filteredItems.length - 1);

  // biome-ignore lint/correctness/useExhaustiveDependencies: we want to set the index to zero whenever the search term changes
  useEffect(() => {
    selectedIndex.reset();
  }, [searchTerm]);

  useRegisterKeybindCommand({
    command: "FinderSelect",
    action() {
      filteredItems[selectedIndex.value]?.item.onSelect?.();
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
        <Input
          placeholder="Type something..."
          autoFocus
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </DialogHeader>
      <div class="flex flex-col h-80 overflow-y-auto">
        {filteredItems.map(({ item, highlightRanges }, i) => (
          <SearchItem
            key={item.searchTerm}
            index={i}
            item={item}
            selectedIndex={selectedIndex.value}
            highlightRanges={highlightRanges}
          />
        ))}
      </div>
    </>
  );
}

function SearchItem({
  selectedIndex,
  item,
  index,
  highlightRanges,
}: {
  selectedIndex: number;
  index: number;
  item: FinderItem;
  highlightRanges: [number, number][] | null;
}) {
  const isActive = selectedIndex === index;
  const { ref } = useIntersectionScroll(isActive);

  return (
    <div
      ref={ref}
      class={cn(isActive && "bg-gray-100", "p-1 rounded flex gap-1")}
      key={item.searchTerm}
    >
      <span>{item.icon}</span>
      <div>
        <Highlight
          style={{}}
          class="text-blue-400"
          text={item.searchTerm}
          ranges={highlightRanges}
        />
      </div>
    </div>
  );
}
