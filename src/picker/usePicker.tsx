import type { FuzzyMatches, FuzzyResult } from "@nozbe/microfuzz";
import createFuzzySearch from "@nozbe/microfuzz";
import {
  createContext,
  createMemo,
  createSignal,
  For,
  type JSXElement,
  onMount,
  type ParentProps,
  Show,
  useContext,
} from "solid-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRef } from "@/lib/useRef";
import { createWatcher } from "../commands/createWatcher";
import { useAppForm } from "../components/form";
import { useRegisterKeybindCommandOnMount } from "../keybinds/useRegisterKeybindCommand";
import { cn } from "../lib/cn";
import { createCounterWithWrap } from "../lib/counter";
import { useIntersectionScroll } from "../lib/useIntersectionScroll";

export interface PickerItem<T> {
  value: T;
  label: string;
  icon?: JSXElement;
}

interface PickerOptions<T> {
  items: PickerItem<T>[];
}

interface PickerContextValue {
  open: <T>(options: PickerOptions<T>) => Promise<T | undefined>;
}

const PickerContext = createContext<PickerContextValue>();

export function PickerProvider(props: ParentProps) {
  const [state, setState] = createSignal<{
    items: PickerItem<unknown>[];
    resolve: (value: unknown | undefined) => void;
  }>();

  function open<T>(options: PickerOptions<T>): Promise<T | undefined> {
    return new Promise((resolve) => {
      setState({
        items: options.items as PickerItem<unknown>[],
        resolve: resolve as (value: unknown | undefined) => void,
      });
    });
  }

  function handleSelect(value: unknown | undefined) {
    const current = state();
    if (current) {
      const resolve = current.resolve;
      setState(undefined);
      resolve(value);
    }
  }

  return (
    <PickerContext.Provider value={{ open }}>
      {props.children}
      <Dialog modal open={!!state()}>
        <DialogContent
          onEscapeKeyDown={(e) => e.preventDefault()}
          class="flex flex-col justify-start overflow-hidden rounded-none border border-zinc-200 bg-zinc-50 p-0 shadow-2xl"
          aria-describedby="Picker"
        >
          <Show when={state()}>
            {(current) => (
              <PickerContent items={current().items} onSelect={handleSelect} />
            )}
          </Show>
        </DialogContent>
      </Dialog>
    </PickerContext.Provider>
  );
}

export function usePicker() {
  const context = useContext(PickerContext);

  if (!context) {
    throw new Error("usePicker must be used within a PickerProvider");
  }

  return context;
}

function PickerContent<T>(props: {
  items: PickerItem<T>[];
  onSelect: (value: T | undefined) => void;
}) {
  const form = useAppForm(() => ({
    defaultValues: { searchTerm: "" },
  }));

  useRegisterKeybindCommandOnMount({
    command: "PickerClose",
    description: "Close the picker dialog.",
    action() {
      props.onSelect(undefined);
    },
    keybindExpression: "Escape",
    overrideInput: true,
  });

  const searchTerm = form.useStore((store) => store.values.searchTerm);

  const filteredItems = (): FuzzyResult<PickerItem<T>>[] => {
    const term = searchTerm();

    if (!term) {
      return props.items.map((i) => ({ item: i, matches: [], score: 0 }));
    }

    const search = createFuzzySearch<PickerItem<T>>(props.items, {
      key: "label",
    });

    const result = search(term);
    return result;
  };

  const selectedIndex = createCounterWithWrap(() => filteredItems().length - 1);

  createWatcher(searchTerm, selectedIndex.reset);

  useRegisterKeybindCommandOnMount({
    command: "PickerSelect",
    description: "Select the highlighted item in the picker.",
    action() {
      const item = filteredItems()[selectedIndex.value()];
      props.onSelect(item?.item.value);
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

  const textRef = useRef();

  onMount(() => {
    setTimeout(() => textRef.get()?.focus(), 100);
  });

  return (
    <>
      <DialogHeader class="border-zinc-200 border-b bg-white p-3">
        <DialogTitle class="sr-only">Picker</DialogTitle>
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
              <field.TextField
                ref={textRef.set}
                autofocus
                type="text"
                placeholder="Type something..."
              />
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

function SearchItem<T>(props: {
  selectedIndex: number;
  index: number;
  item: PickerItem<T>;
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
      <Show when={props.item.icon}>
        <span
          class={cn(
            "flex size-4 shrink-0 items-center justify-center text-zinc-400",
            isActive() && "text-blue-600",
          )}
        >
          {props.item.icon}
        </span>
      </Show>
      <span class="font-mono">{props.item.label}</span>
    </div>
  );
}
