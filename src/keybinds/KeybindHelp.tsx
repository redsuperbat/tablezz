import { type Accessor, createSignal, For, type Setter, Show } from "solid-js";
import { createSolidContext } from "@/createSolidContext";
import { cn } from "@/lib/cn";
import type { PotentialKeybind } from "./KeybindProvider";
import { useRegisterKeybindCommandOnMount } from "./useRegisterKeybindCommand";
import { useRegisterKeybindToggle } from "./useRegisterKeybindToggle";

function KeybindHelpSearch(props: { onClose: () => void }) {
  const { searchQuery, setSearchQuery } = useKeybindHelpContext();

  useRegisterKeybindCommandOnMount({
    command: "KeybindHelpSearchStop",
    description: "Stop searching",
    keybindExpression: "Escape",
    overrideInput: true,
    action() {
      props.onClose();
      setSearchQuery("");
    },
  });

  return (
    <div class="border-zinc-200 border-b px-2 py-1">
      <input
        type="text"
        placeholder="Search keybinds..."
        class="w-full bg-transparent text-zinc-700 outline-none placeholder:text-zinc-400"
        value={searchQuery()}
        autofocus
        onInput={(e) => setSearchQuery(e.currentTarget.value)}
      />
    </div>
  );
}

type KeybindWithMatch = {
  item: PotentialKeybind;
  isMatch: boolean;
  matchRange: [number, number] | undefined;
};

function HighlightedText(props: {
  text: string;
  range: [number, number] | undefined;
  class?: string;
  highlightClass?: string;
}) {
  const parts = () => {
    const range = props.range;
    if (!range) {
      return [{ text: props.text, highlight: false }];
    }

    const [start, end] = range;
    const result: { text: string; highlight: boolean }[] = [];

    if (start > 0) {
      result.push({ text: props.text.slice(0, start), highlight: false });
    }
    result.push({ text: props.text.slice(start, end), highlight: true });
    if (end < props.text.length) {
      result.push({ text: props.text.slice(end), highlight: false });
    }

    return result;
  };

  return (
    <span class={props.class}>
      <For each={parts()}>
        {(part) => (
          <span class={part.highlight ? props.highlightClass : undefined}>
            {part.text}
          </span>
        )}
      </For>
    </span>
  );
}

function KeybindHelpBody(props: { keybindResults: KeybindWithMatch[] }) {
  const { enableSearch, searchQuery } = useKeybindHelpContext();

  const isSearching = useRegisterKeybindToggle({
    command: "KeybindHelpSearch",
    description: "Search keybinds",
    keybindExpression: "/",
  });

  const isFiltering = () => searchQuery().length > 0;

  const columnCount = () =>
    Math.min(3, Math.ceil((props.keybindResults.length ?? 0) / 10));

  const columns = () => {
    const binds = props.keybindResults;
    if (!binds) return [];
    const cols = columnCount();

    const rows = Math.ceil(binds.length / cols);
    const result: KeybindWithMatch[][] = [];

    for (let col = 0; col < cols; col++) {
      const column: KeybindWithMatch[] = [];

      for (let row = 0; row < rows; row++) {
        const index = col * rows + row;

        if (index < binds.length) {
          const bind = binds[index];
          if (!bind) continue;

          column.push(bind);
        }
      }
      result.push(column);
    }

    return result;
  };

  return (
    <div class="absolute right-2 bottom-2 z-50 flex flex-col border border-zinc-200 bg-white font-mono text-sm shadow-lg">
      <Show when={isSearching.value() && enableSearch()}>
        <KeybindHelpSearch onClose={() => isSearching.close()} />
      </Show>
      <div class="flex">
        <For each={columns()}>
          {(column) => (
            <div
              class="grid border-zinc-100 border-l first:border-l-0"
              style={{ "grid-template-columns": "auto 1fr" }}
            >
              <For each={column}>
                {(result) => (
                  <div
                    class={cn(
                      "col-span-2 grid grid-cols-subgrid",
                      isFiltering() &&
                        !result.isMatch &&
                        "opacity-40 grayscale",
                    )}
                  >
                    <HighlightedText
                      text={result.item.command}
                      range={result.matchRange}
                      class="pt-1 pl-2 text-zinc-700"
                      highlightClass="text-blue-600 font-medium"
                    />
                    <span class="px-2 pt-1 text-right">
                      <span class="rounded bg-zinc-100 px-1 py-0.5 text-xs text-zinc-600">
                        {result.item.bind}
                      </span>
                    </span>
                    <span class="col-span-2 border-zinc-100 border-b px-2 pb-1 text-xs text-zinc-400">
                      {result.item.description}
                    </span>
                  </div>
                )}
              </For>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

const [KeybindHelpProvider, , useKeybindHelpContext] = createSolidContext(
  (props: {
    searchQuery: Accessor<string>;
    setSearchQuery: Setter<string>;
    enableSearch: Accessor<boolean>;
  }) => {
    return props;
  },
);

export function KeybindHelp(props: {
  keybinds: PotentialKeybind[];
  enableSearch?: boolean;
}) {
  const [searchQuery, setSearchQuery] = createSignal<string>("");

  const keybindResults = (): KeybindWithMatch[] | undefined => {
    const binds = props.keybinds;
    if (!binds || binds.length === 0) return undefined;

    const sortedBinds = [...binds].sort((a, b) =>
      a.command.localeCompare(b.command),
    );

    const query = searchQuery().toLowerCase();
    if (!query) {
      return sortedBinds.map((item) => ({
        item,
        isMatch: false,
        matchRange: undefined,
      }));
    }

    return sortedBinds.map((item) => {
      const lowerCommand = item.command.toLowerCase();
      const matchIndex = lowerCommand.indexOf(query);

      if (matchIndex !== -1) {
        return {
          item,
          isMatch: true,
          matchRange: [matchIndex, matchIndex + query.length] as [
            number,
            number,
          ],
        };
      }

      return {
        item,
        isMatch: false,
        matchRange: undefined,
      };
    });
  };

  return (
    <KeybindHelpProvider
      enableSearch={() => props.enableSearch ?? false}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
    >
      <Show when={keybindResults()}>
        {(results) => <KeybindHelpBody keybindResults={results()} />}
      </Show>
    </KeybindHelpProvider>
  );
}
