import createFuzzySearch from "@nozbe/microfuzz";
import { type Accessor, createSignal, For, type Setter, Show } from "solid-js";
import { createSolidContext } from "@/createSolidContext";
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

function KeybindHelpBody(props: { potentialKeybinds: PotentialKeybind[] }) {
  const { enableSearch } = useKeybindHelpContext();

  const isSearching = useRegisterKeybindToggle({
    command: "KeybindHelpSearch",
    description: "Search keybinds",
    keybindExpression: "/",
  });

  const columnCount = () =>
    Math.min(3, Math.ceil((props.potentialKeybinds.length ?? 0) / 10));

  const columns = () => {
    const binds = props.potentialKeybinds;
    if (!binds) return [];
    type PotentialKeybind = (typeof binds)[number];
    const cols = columnCount();

    const rows = Math.ceil(binds.length / cols);
    const result: PotentialKeybind[][] = [];

    for (let col = 0; col < cols; col++) {
      const column: PotentialKeybind[] = [];

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
                {(bind) => (
                  <>
                    <span class="pt-1 pl-2 text-zinc-700">{bind.command}</span>
                    <span class="px-2 pt-1 text-right">
                      <span class="rounded bg-zinc-100 px-1 py-0.5 text-xs text-zinc-600">
                        {bind.bind}
                      </span>
                    </span>
                    <span class="col-span-2 border-zinc-100 border-b px-2 pb-1 text-xs text-zinc-400">
                      {bind.description}
                    </span>
                  </>
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

  const potentialKeybinds = () => {
    const binds = props.keybinds;
    if (!binds) return;

    const query = searchQuery();
    if (!query) return binds;

    const search = createFuzzySearch(binds, {
      getText: (item) => [item.command],
    });

    return search(query).map((r) => r.item);
  };

  return (
    <KeybindHelpProvider
      enableSearch={() => props.enableSearch ?? false}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
    >
      <Show when={potentialKeybinds()}>
        {(binds) => <KeybindHelpBody potentialKeybinds={binds()} />}
      </Show>
    </KeybindHelpProvider>
  );
}
