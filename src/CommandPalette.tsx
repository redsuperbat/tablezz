import Fuse from "fuse.js";
import { Route, Table } from "lucide-react";
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
import { useTableContext } from "./TableProvider";
import { useDatabaseSchema } from "./useDatabaseSchema";

interface CommandPaletteItem {
  icon: ReactNode;
  onSelect(): void;
  searchTerm: string;
}

export function CommandPalette() {
  const { setTableName } = useTableContext();
  const { routes, navigateTo } = useRouter();
  const [open, setOpen] = useState(false);
  const databaseSchema = useDatabaseSchema();
  const [searchTerm, setSearchTerm] = useState<string>();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const tables = useMemo(() => {
    return databaseSchema.data ?? [];
  }, [databaseSchema]);

  const items = useMemo((): CommandPaletteItem[] => {
    return [
      ...tables.map((t) => ({
        icon: <Table />,
        searchTerm: t.table_name,
        onSelect() {
          setTableName(t.table_name);
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
  }, [tables, routes, setTableName, navigateTo]);

  const filteredItems = useMemo(() => {
    const fuse = new Fuse(items, {
      keys: ["searchTerm"],
    });

    if (!searchTerm) {
      return items;
    }

    return fuse.search(searchTerm).map((r) => r.item);
  }, [items, searchTerm]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: we want to set the index to zero whenever the search term changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm]);

  useRegisterKeybind({
    name: "CommandPaletteShow",
    onTrigger: () => setOpen(true),
    keybindExpression: "Meta + k",
  });

  useRegisterKeybind({
    name: "CommandPaletteSelect",
    onTrigger() {
      filteredItems[selectedIndex].onSelect?.();
      setOpen(false);
      setSearchTerm(undefined);
    },
    keybindExpression: "Enter",
  });

  useRegisterKeybind({
    name: "CommandPaletteSelectPrev",
    keybindExpression: "(Control + k) | ArrowUp",
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
          {filteredItems.map((item, i) => (
            <SearchItem
              key={item.searchTerm}
              index={i}
              item={item}
              selectedIndex={selectedIndex}
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
}: {
  selectedIndex: number;
  index: number;
  item: CommandPaletteItem;
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
      <span>{item.searchTerm}</span>
    </div>
  );
}
