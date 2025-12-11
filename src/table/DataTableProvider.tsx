import {
  type Accessor,
  createContext,
  createMemo,
  createSignal,
  type JSXElement,
  useContext,
} from "solid-js";
import z from "zod";
import { useCommandsContext } from "@/commands/CommandsContext";
import { createWatcher } from "@/commands/createWatcher";
import { message } from "@/commands/Messages";
import { useRegisterCommandOnMount } from "@/commands/useRegisterCommand";
import { useEditor } from "@/editor/useEditor";
import { useHopContext } from "@/HopContext";
import { useKeybindContext } from "@/keybinds/KeybindProvider";
import {
  useRegisterKeybindCommand,
  useRegisterKeybindCommandOnMount,
} from "@/keybinds/useRegisterKeybindCommand";
import { createCounterWithBoundaries } from "@/lib/counter";
import { useRef } from "@/lib/useRef";
import { useBatchExecute } from "@/useBatchExecute";
import { useTableCount } from "@/useTableCount";
import type { ForeignKey, PostgresDataType } from "@/useTableStructure";
import { Cell } from "./Cell";
import { Column } from "./Column";
import { createDataType } from "./DataType";
import { Row } from "./Row";
import { Table } from "./Table";
import { UndoTree } from "./UndoTree";
import { VisualSelection } from "./VisualSelection";

interface TableEditorContext {
  currentCell: Accessor<Cell>;
  getTable: Accessor<Table>;
  visualSelection: Accessor<VisualSelection>;
  setTableContainerRef: (el: HTMLElement) => void;
  setRowRef: (el: HTMLElement) => void;
}

const TableEditorContext = createContext<TableEditorContext | null>(null);

export function DataTableProvider(props: {
  rows: unknown[];
  name: string;
  initialRowIndex: number | undefined;
  initialColumnIndex: number | undefined;
  structure: {
    columnName: string;
    dataType: PostgresDataType;
    isPrimary: boolean;
    isNullable: boolean;
    foreignKey: ForeignKey | null;
  }[];
  children: JSXElement;
  reload: () => void;
}) {
  const batchExecute = useBatchExecute();

  const columns = createMemo(() =>
    props.structure.map(
      (c, index) =>
        new Column({
          name: c.columnName,
          isPrimary: c.isPrimary,
          isNullable: c.isNullable,
          foreignKey: c.foreignKey,
          dataType: createDataType(c.dataType, c.isNullable),
          rawType: c.dataType,
          index,
        }),
    ),
  );

  const rows = createMemo((): Row[] => {
    return props.rows.map((row, rowIndex) => {
      const cells = Object.entries(row as object)
        .values()
        .map(([name, data]) => {
          const column = columns().find((c) => c.name === name);

          if (!column) {
            return;
          }

          return new Cell({
            // We lazily self reference here for convenience
            // these functions never recurse indefinitely since there is
            // a cache layer handling base cases
            getTable: () => getTable(),
            getColumn: () => column,
            getRow: () => rows().at(rowIndex) as Row,
            data,
          });
        })
        .filter((v) => v !== undefined)
        .toArray();

      return new Row(cells, rowIndex);
    });
  });

  const getTable = createMemo(
    () => new Table({ rows: rows(), columns: columns(), name: props.name }),
  );

  const undoTree = new UndoTree();

  const [visualModeStartCell, setVisualModeStartCell] = createSignal<Cell>();
  const keybindContext = useKeybindContext();
  const registerKeybindCommand = useRegisterKeybindCommand();

  const rowRef = useRef();
  const tableContainerRef = useRef();

  const visibleRows = () => {
    const rowEl = rowRef.get();
    const containerEl = tableContainerRef.get();
    if (!containerEl || !rowEl) return 10; // fallback
    const rowHeight = rowEl.offsetHeight || 37;
    return Math.max(1, Math.floor(containerEl.clientHeight / rowHeight / 2));
  };

  const hopContext = useHopContext();

  const row = createCounterWithBoundaries({
    max: () => getTable().getRows().length - 1,
    min: 0,
    initialValue: props.initialRowIndex,
  });

  const column = createCounterWithBoundaries({
    max: () => getTable().getColumns().length - 1,
    min: 0,
    initialValue: props.initialColumnIndex,
  });

  useRegisterCommandOnMount({
    command: "SqlQuery",
    description: "Run a custom SQL query and display the results.",
    actionArgs: [z.string().min(1).meta({ title: "<sql>" }).optional()],
    async action(sql) {
      if (sql === undefined) {
        sql = await editor.open({
          initialContent: "",
          extension: ".sql",
        });
      }

      hopContext.add({
        query: sql,
        previousColumnIndex: column.value(),
        previousRowIndex: row.value(),
      });
    },
  });

  const currentCell = () =>
    getTable().getRow(row.value())?.getCell(column.value()) as Cell;

  const visualSelection = createMemo(() => {
    return new VisualSelection({
      start: visualModeStartCell(),
      current: currentCell(),
      table: getTable(),
      onExit() {
        keybindContext.unregisterKeybind({
          keybindExpression: "Escape | v",
          command: "VisualModeExit",
        });
        setVisualModeStartCell(undefined);
      },
      onEnter() {
        const disposable = registerKeybindCommand({
          keybindExpression: "Escape | v",
          command: "VisualModeExit",
          description: "Exit visual selection mode.",
          action() {
            disposable.dispose();
            visualSelection().exit();
          },
        });
      },
    });
  });

  useRegisterKeybindCommandOnMount({
    keybindExpression: "w",
    command: "WriteChanges",
    description:
      "Write pending cell changes and row deletions to the database.",
    async action() {
      const modifiedCells = getTable()
        .getAllCells()
        .filter((c) => c.isDirty && !c.getRow().isDeleted);

      const deletedRows = getTable()
        .getRows()
        .filter((r) => r.isDeleted);

      const statements: string[] = [];

      for (const cell of modifiedCells) {
        const column = cell.getColumn();
        const columnName = column.name;
        const primaryKeys = cell
          .getRow()
          .getCells()
          .filter((c) => c.isPrimary())
          .map((c) => ({
            columnName: c.getColumn().name,
            value: c.getDataType().toSqlValue(c.originalData),
          }));

        if (primaryKeys.length === 0) {
          message.error(
            `Can't update, no primary key in table "${props.name}"`,
          );
          continue;
        }

        statements.push(
          `UPDATE "${props.name}" SET "${columnName}" = ${cell.toSqlValue()} WHERE ${primaryKeys.map((p) => `"${p.columnName}" = ${p.value}`).join(" AND ")}`,
        );
      }

      for (const row of deletedRows) {
        const primaryKeys = row
          .getCells()
          .filter((c) => c.isPrimary())
          .map((c) => ({
            columnName: c.getColumn().name,
            value: c.getDataType().toSqlValue(c.originalData),
          }));

        if (primaryKeys.length === 0) {
          message.error(
            `Can't delete row, no primary key in table "${props.name}"`,
          );
          continue;
        }

        statements.push(
          `DELETE FROM "${props.name}" WHERE ${primaryKeys.map((p) => `"${p.columnName}" = ${p.value}`).join(" AND ")}`,
        );
      }

      if (statements.length === 0) {
        return;
      }

      try {
        await batchExecute.exec(statements);
        message.info(`Successfully updated`);
      } finally {
        props.reload();
      }
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "VisualModeEnter",
    description: "Enter visual selection mode.",
    keybindExpression: "v",
    action() {
      visualSelection().enter();
      setVisualModeStartCell(currentCell());
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "Undo",
    description: "Undo latest changes",
    keybindExpression: "u",
    action() {
      undoTree.undo();
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "SelectionUndo",
    description: "Undo changes in the selected cells.",
    keybindExpression: "s > u",
    action() {
      const selection = visualSelection();
      selection.getAllIntersectingCells().forEach((c) => c.undo());
      selection.exit();
    },
  });

  const editor = useEditor();

  useRegisterKeybindCommandOnMount({
    command: "OpenCellEditor",
    description: "Open the cell editor for the current selection.",
    keybindExpression: "c",
    async action() {
      const columnDelimiter = "\x1F";
      const rowDelimiter = "\x1F\n";
      const selection = visualSelection();

      const intersectingCells = selection.getAllIntersectingCells();

      const extension = intersectingCells.at(0)?.getDataType().fileExtension();

      const initialContent = selection.intersectingCellsToString({
        columnDelimiter,
        rowDelimiter,
      });

      const data = await editor.open({
        initialContent,
        extension,
      });

      selection.updateIntersectingCells({
        stringifiedCells: data,
        columnDelimiter,
        rowDelimiter,
      });

      undoTree.addChange({
        undo() {
          intersectingCells.forEach((c) => c.undo());
        },
      });

      selection.exit();
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "GoBackward",
    keybindExpression: "Control + o",
    action() {
      hopContext.pop();
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "GoToForeignKeyRelation",
    description: "Move to the entry where the cursor is at",
    keybindExpression: "g > d",
    action() {
      const cell = currentCell();
      const cellColumn = cell.getColumn();

      if (cellColumn.foreignKey === null) {
        return;
      }

      const value = cell.toSqlValue();
      const query = `SELECT * FROM "${cellColumn.foreignKey.table}" WHERE "${cellColumn.foreignKey.column}" = ${value}`;

      hopContext.add({
        query,
        previousColumnIndex: column.value(),
        previousRowIndex: row.value(),
      });
    },
  });

  const count = useTableCount(() => props.name);
  const commandContext = useCommandsContext();

  createWatcher(count, ({ next }) =>
    commandContext.addCommandLineSuffix(
      <div class="text-zinc-500">
        {props.name} · {props.rows.length}/{next} rows
      </div>,
    ),
  );

  useRegisterKeybindCommandOnMount({
    command: "GoToBottom",
    description: "Move to the last row of the table.",
    keybindExpression: "G",
    action: row.setToMax,
  });

  useRegisterKeybindCommandOnMount({
    command: "GoDownHalf",
    description: "Move down by half a page.",
    keybindExpression: "Control + d",
    action() {
      row.increment(visibleRows());
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "GoUpHalf",
    description: "Move up by half a page.",
    keybindExpression: "Control + u",
    action() {
      row.decrement(visibleRows());
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "GoToTop",
    description: "Move to the first row of the table.",
    keybindExpression: "g > g",
    action: row.reset,
  });

  useRegisterKeybindCommandOnMount({
    command: "GoToLeftEnd",
    description: "Move the cursor to the left end of the table.",
    keybindExpression: "^",
    action() {
      column.reset();
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "GoToRightEnd",
    description: "Move the cursor to the right end of the table.",
    keybindExpression: "$",
    action() {
      column.setToMax();
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "MoveCellRight",
    description: "Move the cursor right by one or more cells.",
    keybindExpression: "l",
    actionArgs: [z.coerce.number().optional().meta({ title: "<distance>" })],
    action(distance) {
      column.increment(distance);
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "MoveCellLeft",
    description: "Move the cursor left by one or more cells.",
    keybindExpression: "h",
    actionArgs: [z.coerce.number().optional().meta({ title: "<distance>" })],
    action(distance) {
      column.decrement(distance);
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "MoveCellUp",
    description: "Move the cursor up by one or more cells.",
    keybindExpression: "k",
    actionArgs: [z.coerce.number().optional().meta({ title: "<distance>" })],
    action(distance) {
      row.decrement(distance);
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "MoveCellDown",
    description: "Move the cursor down by one or more cells.",
    keybindExpression: "j",
    actionArgs: [z.coerce.number().optional().meta({ title: "<distance>" })],
    action(distance) {
      row.increment(distance);
    },
  });

  useRegisterKeybindCommandOnMount({
    keybindExpression: "d > d",
    command: "DeleteRow",
    description: "Mark the selected rows for deletion.",
    action() {
      const selection = visualSelection();
      const rows = selection.getAllIntersectingRows();

      if (rows.every((r) => r.isDeleted)) {
        return selection.exit();
      }

      rows.forEach((r) => r.markForDeletion());
      undoTree.addChange({
        undo: () => rows.forEach((r) => r.restore()),
      });

      selection.exit();
    },
  });

  return (
    <TableEditorContext.Provider
      value={{
        currentCell,
        visualSelection,
        getTable,
        setTableContainerRef: tableContainerRef.set,
        setRowRef: rowRef.set,
      }}
    >
      {props.children}
    </TableEditorContext.Provider>
  );
}

export function useTableEditorContext() {
  const ctx = useContext(TableEditorContext);

  if (!ctx) {
    throw new Error("No table editor context found");
  }

  return ctx;
}
