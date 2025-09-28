import { Highlight, useFuzzySearchList } from "@nozbe/microfuzz/react";
import { Folder, Route, Table } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "./components/ui/input";
import { useRegisterKeybind } from "./keybinds/useRegisterKeybind";
import { cn } from "./lib/utils";
import { useRouter } from "./Router";
import { useSchemaContext } from "./SchemaProvider";
import { useSelectedTableContext } from "./SelectedTableProvider";
import { useSelectedDatabaseSchemas } from "./useSelectedDatabaseSchemas";
import { useSelectedSchemaTables } from "./useSelectedSchemaTables";

interface CommandPaletteItem {
  icon: ReactNode;
  onSelect(): void;
  searchTerm: string;
}

export function CommandPalette() {
  const { setSelectedTable } = useSelectedTableContext();
  const { routes, navigateTo } = useRouter();
  const selectedSchema = useSelectedSchemaTables();
  const selectedSchemas = useSelectedDatabaseSchemas();
  const { setSchema } = useSchemaContext();

  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const tables = useMemo(() => selectedSchema.data ?? [], [selectedSchema]);

  const schemas = useMemo(() => selectedSchemas.data ?? [], [selectedSchemas]);

  const items = useMemo((): CommandPaletteItem[] => {
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

  const filteredItems = useFuzzySearchList({
    list: items,
    getText: (i) => [i.searchTerm],
    queryText: searchTerm,
    mapResultItem: (r) => ({
      item: r.item,
      highlightRanges: r.matches.at(0) ?? null,
    }),
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: we want to set the index to zero whenever the search term changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm, items]);

  useRegisterKeybind({
    name: "CommandPaletteShow",
    onTrigger: () => setOpen(true),
    keybindExpression: "Leader + Space",
  });

  useRegisterKeybind({
    name: "CommandPaletteSelect",
    onTrigger() {
      filteredItems[selectedIndex].item.onSelect?.();
      setOpen(false);
      setSearchTerm("");
    },
    keybindExpression: "Enter",
    overrideInput: true,
  });

  useRegisterKeybind({
    name: "CommandPaletteSelectPrev",
    keybindExpression: "(Control + k) | ArrowUp",
    overrideInput: true,
    onTrigger() {
      if (selectedIndex === 0) {
        return setSelectedIndex(filteredItems.length - 1);
      }
      setSelectedIndex((i) => i - 1);
    },
  });

  useRegisterKeybind({
    name: "CommandPaletteSelectNext",
    keybindExpression: "(Control + j) | ArrowDown",
    overrideInput: true,
    onTrigger() {
      if (selectedIndex === filteredItems.length - 1) {
        return setSelectedIndex(0);
      }
      setSelectedIndex((i) => i + 1);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="flex flex-col justify-start"
        showCloseButton={false}
        aria-describedby="Command palette"
      >
        <DialogHeader>
          <DialogTitle className="sr-only">Command palette</DialogTitle>
          <Input
            placeholder="Type something..."
            autoFocus
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </DialogHeader>
        <div className="flex flex-col h-80 overflow-y-auto">
          {filteredItems.map(({ item, highlightRanges }, i) => (
            <SearchItem
              key={item.searchTerm}
              index={i}
              item={item}
              selectedIndex={selectedIndex}
              highlightRanges={highlightRanges}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
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
  item: CommandPaletteItem;
  highlightRanges: [number, number][] | null;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { threshold: 1.0 }, // Element must be fully visible
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (selectedIndex === index && !isInView) {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedIndex, index, isInView]);

  return (
    <div
      ref={ref}
      className={cn(
        index === selectedIndex && "bg-gray-100",
        "p-1 rounded flex gap-1",
      )}
      key={item.searchTerm}
    >
      <span>{item.icon}</span>
      <div>
        <Highlight
          style={{}}
          className="text-blue-400"
          text={item.searchTerm}
          ranges={highlightRanges}
        />
      </div>
    </div>
  );
}
