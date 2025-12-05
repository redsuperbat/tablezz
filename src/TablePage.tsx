import { createSignal, Match, Show, Switch } from "solid-js";
import { useCommandsContext } from "./commands/CommandsContext";
import { createWatcher } from "./commands/createWatcher";
import { Dialog, DialogContent } from "./components/ui/dialog";
import { QueryHistory } from "./database/QueryHistoryProvider";
import { Editor } from "./editor/Editor";
import { useRegisterKeybindToggle } from "./keybinds/useRegisterKeybindToggle";
import { useSchemaContext } from "./SchemaProvider";
import { useSelectedTableContext } from "./SelectedTableProvider";
import { DataTable } from "./table/DataTable";
import { DataTableProvider } from "./table/DataTableProvider";
import type { VisualSelection } from "./table/VisualSelection";
import { useTableCount } from "./useTableCount";
import { useTableRows } from "./useTableRows";
import { useTableStructure } from "./useTableStructure";

export function TablePage() {
  const { schema } = useSchemaContext();
  const { selectedTable } = useSelectedTableContext();
  const [selectionToEdit, setSelectionToEdit] = createSignal<VisualSelection>();
  const commandContext = useCommandsContext();

  const showQueryHistory = useRegisterKeybindToggle({
    command: "ToggleQueryHistory",
    description: "Show or hide the SQL query history panel.",
    keybindExpression: "Leader > q",
    initialValue: false,
  });

  const gridTemplateRows = () =>
    [selectedTable(), showQueryHistory.value()]
      .filter(Boolean)
      .map(() => "1fr")
      .join(" ");

  const structureQuery = useTableStructure(selectedTable);
  const structureData = () => structureQuery.data ?? [];
  const rowsQuery = useTableRows(selectedTable, structureData);
  const count = useTableCount(selectedTable);

  function reload() {
    rowsQuery.refetch();
    structureQuery.refetch();
  }

  createWatcher(count, ({ next }) =>
    commandContext.addCommandLineSuffix(
      <div class="text-zinc-500">
        {schema()}.{selectedTable()} · {rowsQuery.data?.length}/{next} rows
      </div>,
    ),
  );
  const columnDelimiter = "\x1F";
  const rowDelimiter = "\x1F\n";

  return (
    <div
      class="grid h-full overflow-hidden"
      style={{
        "grid-template-rows": gridTemplateRows(),
      }}
    >
      <Switch>
        <Match when={rowsQuery.error}>{(error) => error().message}</Match>
        <Match when={rowsQuery.data}>
          {(rows) => (
            <DataTableProvider
              reload={reload}
              structure={structureData()}
              rows={rows()}
              name={selectedTable()}
              onEditSelection={setSelectionToEdit}
            >
              <DataTable reload={reload} />
            </DataTableProvider>
          )}
        </Match>
      </Switch>

      <Dialog modal open={!!selectionToEdit()}>
        <DialogContent
          onEscapeKeyDown={(e) => e.preventDefault()}
          class="flex h-[80vh] max-w-[80vw] flex-col justify-start border-none p-0 shadow-none"
        >
          <Show when={selectionToEdit()}>
            {(selection) => {
              const extension = selection()
                .getAllIntersectingCells()
                .at(0)
                ?.getColumn()
                .getDataType()
                .fileExtension();

              return (
                <Editor
                  extension={extension}
                  initialContent={selection().intersectingCellsToString({
                    columnDelimiter,
                    rowDelimiter,
                  })}
                  onExit={(data) => {
                    selection().updateIntersectingCells({
                      stringifiedCells: data,
                      columnDelimiter,
                      rowDelimiter,
                    });

                    if (selection().isSelecting) {
                      commandContext.triggerCommand("VisualModeExit");
                    }
                    setSelectionToEdit(undefined);
                  }}
                />
              );
            }}
          </Show>
        </DialogContent>
      </Dialog>

      <Show when={showQueryHistory.value()}>
        <QueryHistory />
      </Show>
    </div>
  );
}
