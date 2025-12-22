import {
  type Accessor,
  batch,
  createContext,
  createMemo,
  createSignal,
  type JSXElement,
  onCleanup,
  useContext,
} from "solid-js";
import z from "zod";
import { useCommandsContext } from "@/commands/CommandsContext";
import { createWatcher } from "@/commands/createWatcher";
import { message } from "@/commands/Messages";
import { useRegisterCommandOnMount } from "@/commands/useRegisterCommand";
import type { TableStructure } from "@/database/database";
import { useEditor } from "@/editor/useEditor";
import { useHopContext } from "@/HopContext";
import { useRegisterKeybindCommandOnMount } from "@/keybinds/useRegisterKeybindCommand";
import { useRegisterKeybindCommandOnConditional } from "@/keybinds/useRegisterKeybindCommandOnConditional";
import { createBoundedCounterWithExternalState } from "@/lib/counter";
import { useRef } from "@/lib/useRef";
import { useBatchExecute } from "@/useBatchExecute";
import { useTableCount } from "@/useTableCount";
import { Cell } from "./Cell";
import { Column } from "./Column";
import { createDataType } from "./DataType";
import { Row } from "./Row";
import { Table } from "./Table";
import { UndoTree } from "./UndoTree";
import { VisualSelection } from "./VisualSelection";

interface TableEditorContext {
  currentCell: Accessor<Cell | undefined>;
  getTable: Accessor<Table>;
  visualSelection: Accessor<VisualSelection>;
  tableContainerRef: ReturnType<typeof useRef>;
  rowRef: ReturnType<typeof useRef>;
  rowHeight: Accessor<number>;
  numberOfVisibleRows: Accessor<number>;
}

const TableEditorContext = createContext<TableEditorContext | null>(null);

export function DataTableProvider(props: {
  rows: unknown[];
  tableName: string;
  schemaName?: string;
  initialRowIndex: number | undefined;
  initialColumnIndex: number | undefined;
  structure: TableStructure[];
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
          index,
        }),
    ),
  );

  const rows = createMemo((): Row[] => {
    return props.rows.map((row, rowIndex) => {
      const cells = Object.entries(row as object)
        .values()
        .map(([name, data]) => {
          return new Cell({
            // We lazily self reference here for convenience
            // these functions never recurse indefinitely since there is
            // a cache layer handling base cases
            getTable: () => getTable(),
            getColumn: () => columns().find((c) => c.name === name) as Column,
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
    () =>
      new Table({
        rows: rows(),
        columns: columns(),
        name: props.tableName,
      }),
  );

  const undoTree = new UndoTree();

  const [visualModeStartCell, setVisualModeStartCell] = createSignal<Cell>();

  const rowRef = useRef();
  const tableContainerRef = useRef();

  const rowHeight = () => {
    const rowEl = rowRef.get();
    if (!rowEl) return 37;
    return rowEl.offsetHeight;
  };

  const numberOfVisibleRows = () => {
    const containerEl = tableContainerRef.get();
    if (!containerEl) return 10;

    const rHeight = rowHeight();
    return Math.max(1, Math.floor(containerEl.clientHeight / rHeight / 2));
  };

  const hopContext = useHopContext();

  const row = createBoundedCounterWithExternalState({
    max: () => getTable().getRows().length - 1,
    min: 0,
    setValue: hopContext.setRowIndex,
    value: () => hopContext.current().rowIndex,
  });

  const column = createBoundedCounterWithExternalState({
    max: () => getTable().getColumns().length - 1,
    min: 0,
    setValue: hopContext.setColumnIndex,
    value: () => hopContext.current().columnIndex,
  });

  useRegisterCommandOnMount({
    command: "SqlSelect",
    description: "Run a custom SQL select query and display the results.",
    actionArgs: [z.string().min(1).meta({ title: "<sql>" }).optional()],
    async action(sql) {
      if (sql === undefined) {
        sql = await editor.open({
          initialContent: "",
          extension: ".sql",
        });
      }

      hopContext.add({ query: sql });
    },
  });

  const currentCell = () => {
    const table = getTable();

    // Handle empty table - no cells exist
    if (table.getRows().length === 0) {
      return undefined;
    }

    const cell = table.getRow(row.value())?.getCell(column.value());

    // If the cell is somehow not found
    // we reset the index and return the cell again
    if (!cell) {
      batch(() => {
        row.reset();
        column.reset();
      });

      return currentCell();
    }

    return cell;
  };

  const visualSelection = createMemo(() => {
    return new VisualSelection({
      start: visualModeStartCell(),
      current: currentCell(),
      table: getTable(),
      onExit() {
        setVisualModeStartCell(undefined);
      },
    });
  });

  useRegisterKeybindCommandOnConditional({
    predicate: () => !!visualModeStartCell(),
    false: {
      keybindExpression: "v",
      command: "VisualModeEnter",
      description: "Enter visual selection mode.",
      action() {
        setVisualModeStartCell(currentCell());
      },
    },
    true: {
      keybindExpression: "Escape | v",
      command: "VisualModeExit",
      description: "Exit visual selection mode.",
      action() {
        visualSelection().exit();
      },
    },
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
            `Can't update, no primary key in table "${props.tableName}"`,
          );
          continue;
        }

        statements.push(
          `UPDATE "${props.tableName}" SET "${columnName}" = ${cell.toSqlValue()} WHERE ${primaryKeys.map((p) => `"${p.columnName}" = ${p.value}`).join(" AND ")}`,
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
            `Can't delete row, no primary key in table "${props.tableName}"`,
          );
          continue;
        }

        statements.push(
          `DELETE FROM "${props.tableName}" WHERE ${primaryKeys.map((p) => `"${p.columnName}" = ${p.value}`).join(" AND ")}`,
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
    command: "Undo",
    description: "Undo latest changes",
    keybindExpression: "u",
    action() {
      undoTree.undo();
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

      const extension =
        intersectingCells.length === 1
          ? intersectingCells.at(0)?.getDataType().fileExtension()
          : undefined;

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
      if (!cell) return;

      const cellColumn = cell.getColumn();

      if (cellColumn.foreignKey === null) {
        return;
      }

      const value = cell.toSqlValue();
      const query = `SELECT * FROM "${cellColumn.foreignKey.table}" WHERE "${cellColumn.foreignKey.column}" = ${value}`;

      hopContext.add({ query });
    },
  });

  const count = useTableCount(() => props.tableName);
  const commandContext = useCommandsContext();

  createWatcher(count, ({ next }) =>
    commandContext.addCommandLineSuffix(
      <div class="text-zinc-500">
        {props.tableName} · {props.rows.length}/{next} rows
      </div>,
    ),
  );

  commandContext.registerVariable("%", () => `"${props.tableName}"`);
  commandContext.registerVariable("%", () => `"${props.tableName}"`);
  commandContext.registerVariable("&", () => currentCell()?.toSqlValue() ?? "");
  commandContext.registerVariable(
    "@",
    () => `"${currentCell()?.getColumn().name ?? ""}"`,
  );
  onCleanup(() => {
    commandContext.unregisterVariable("%");
    commandContext.unregisterVariable("&");
    commandContext.unregisterVariable("@");
  });

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
      row.increment(numberOfVisibleRows());
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "GoUpHalf",
    description: "Move up by half a page.",
    keybindExpression: "Control + u",
    action() {
      row.decrement(numberOfVisibleRows());
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
      try {
        const rows = selection.getAllIntersectingRows();

        if (rows.every((r) => r.isDeleted)) {
          return;
        }

        rows.forEach((r) => r.markForDeletion());
        undoTree.addChange({
          undo: () => rows.forEach((r) => r.restore()),
        });
      } finally {
        selection.exit();
      }
    },
  });

  useRegisterCommandOnMount({
    command: "TruncateTable",
    description: "Remove all rows from the current table.",
    actionArgs: [z.string().meta({ title: "<table-name>" })],
    async action(tableName: string) {
      try {
        await batchExecute.exec([`TRUNCATE TABLE "${tableName}"`]);
        message.info(`Truncated table "${tableName}"`);
      } finally {
        props.reload();
      }
    },
  });

  return (
    <TableEditorContext.Provider
      value={{
        currentCell,
        numberOfVisibleRows,
        visualSelection,
        getTable,
        tableContainerRef,
        rowRef,
        rowHeight,
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
