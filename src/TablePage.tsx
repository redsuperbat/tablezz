import { createSignal, Match, Show, Switch } from "solid-js";
import { useCommandsContext } from "./commands/CommandsContext";
import { createWatcher } from "./commands/createWatcher";
import { Dialog, DialogContent } from "./components/ui/dialog";
import { QueryHistory } from "./database/QueryHistoryProvider";
import { useDatabase } from "./database/useDatabase";
import { Editor } from "./editor/Editor";
import { useRegisterKeybindCommandOnMount } from "./keybinds/useRegisterKeybindCommand";
import { useRegisterKeybindToggle } from "./keybinds/useRegisterKeybindToggle";
import { useSelectedTableContext } from "./SelectedTableProvider";
import { DataTable } from "./table/DataTable";
import { DataTableProvider } from "./table/DataTableProvider";
import type { VisualSelection } from "./table/VisualSelection";
import { useTableCount } from "./useTableCount";
import { useTableRows } from "./useTableRows";
import { useTableStructure } from "./useTableStructure";

type PreparedStatement = {
  tableName: string;
  columnName: string;
  primaryKeyColumnName: unknown;
  primaryKeyValue: unknown;
  value: unknown;
};

export function TablePage() {
  const { selectedTable } = useSelectedTableContext();
  const [preparedStatements, setPreparedStatements] = createSignal<
    PreparedStatement[]
  >([]);
  const [selectionToEdit, setSelectionToEdit] = createSignal<VisualSelection>();
  const commandContext = useCommandsContext();
  const database = useDatabase();

  const showQueryHistory = useRegisterKeybindToggle({
    command: "ToggleQueryHistory",
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

  useRegisterKeybindCommandOnMount({
    keybindExpression: "w",
    command: "WriteChanges",
    async action() {
      const statements = preparedStatements();
      try {
        for (const statement of statements) {
          const sqlStatement = `
            UPDATE "${statement.tableName}"
            SET "${statement.columnName}" = '${statement.value}'
            WHERE "${statement.primaryKeyColumnName}" = '${statement.primaryKeyValue}';`;
          await database.execute(sqlStatement);
        }
      } finally {
        // We want to do this if the update fails or succeeds
        setPreparedStatements([]);
        reload();
      }
    },
  });

  createWatcher(count, ({ next }) =>
    commandContext.addCommandLineSuffix(
      <div class="text-zinc-500">
        {rowsQuery.data?.length}/{next} rows
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
              structure={structureData()}
              rows={rows()}
              name={selectedTable()}
              onEditSelection={setSelectionToEdit}
              onPreparedStatementCreated={(data) => {
                setPreparedStatements((statements) => [...statements, data]);
              }}
            >
              <DataTable reload={reload} />
            </DataTableProvider>
          )}
        </Match>
      </Switch>

      <Dialog modal open={!!selectionToEdit()}>
        <DialogContent
          onEscapeKeyDown={(e) => e.preventDefault()}
          class="m-0 flex h-[80vh] max-w-[80vw] flex-col justify-start border-none p-0 shadow-none"
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
                    try {
                      const cells = selection()
                        .updateIntersectingCells({
                          stringifiedCells: data,
                          columnDelimiter,
                          rowDelimiter,
                        })
                        .filter((c) => c.isDirty);

                      for (const cell of cells) {
                        commandContext.triggerCommand(
                          `CellEdit ${cell.getColumn().index} ${cell.getRow().index} '${cell.toString()}'`,
                        );
                      }
                    } finally {
                      if (selection().isSelecting) {
                        commandContext.triggerCommand("VisualModeExit");
                      }
                      setSelectionToEdit(undefined);
                    }
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
