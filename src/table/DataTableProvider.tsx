import {
  type Accessor,
  createContext,
  createMemo,
  createSignal,
  type JSXElement,
  useContext,
} from "solid-js";
import z from "zod";
import { useDatabase } from "@/database/useDatabase";
import {
  useRegisterKeybindCommand,
  useRegisterKeybindCommandOnMount,
} from "@/keybinds/useRegisterKeybindCommand";
import { createCounterWithBoundaries } from "@/lib/counter";
import type { PostgresDataType } from "@/useTableStructure";
import { Cell } from "./Cell";
import { Column } from "./Column";
import { createDataType } from "./DataType";
import { Row } from "./Row";
import { Table } from "./Table";
import { VisualSelection } from "./VisualSelection";

interface TableEditorContext {
  currentCell: Accessor<Cell>;
  getTable: Accessor<Table>;
  visualSelection: Accessor<VisualSelection>;
}

const TableEditorContext = createContext<TableEditorContext | null>(null);

export function DataTableProvider(props: {
  rows: unknown[];
  name: string;
  structure: {
    columnName: string;
    dataType: PostgresDataType;
    isPrimary: boolean;
    isNullable: boolean;
  }[];
  onEditSelection?(selection: VisualSelection): void;
  children: JSXElement;
  reload: () => void;
}) {
  const database = useDatabase();

  const columns = createMemo(() =>
    props.structure.map(
      (c, index) =>
        new Column({
          name: c.columnName,
          isPrimary: c.isPrimary,
          isNullable: c.isNullable,
          dataType: createDataType(c.dataType, c.isNullable),
          index,
        }),
    ),
  );

  const rows = createMemo((): Row[] => {
    return props.rows.map((row, rowIndex) => {
      const cells = Object.entries(row as object)
        .values()
        .map(([name, data], columnIndex) => {
          const dataType = props.structure.find((s) => s.columnName === name);

          if (!dataType) {
            return;
          }

          return new Cell({
            // We lazily self reference here for convenience
            // these functions never recurse indefinitely since there is
            // a cache layer handling base cases
            getTable: () => getTable(),
            getColumn: () => columns().at(columnIndex) as Column,
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

  const [visualModeStartCell, setVisualModeStartCell] = createSignal<Cell>();
  const registerKeybindCommand = useRegisterKeybindCommand();

  const visibleRows = 10;

  const row = createCounterWithBoundaries({
    max: () => getTable().getRows().length - 1,
    min: 0,
  });

  const column = createCounterWithBoundaries({
    max: () => getTable().getColumns().length - 1,
    min: 0,
  });

  const visualSelection = createMemo(() => {
    return new VisualSelection({
      start: visualModeStartCell(),
      current: getTable().getRow(row.value())?.getCell(column.value()) as Cell,
      table: getTable(),
      exit: () => setVisualModeStartCell(undefined),
    });
  });

  const currentCell = () => visualSelection().current;

  useRegisterKeybindCommandOnMount({
    keybindExpression: "w",
    command: "WriteChanges",
    description: "Write pending cell changes to the database.",
    async action() {
      const modifiedCells = getTable()
        .getAllCells()
        .filter((c) => c.isDirty);

      try {
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

          const sqlStatement = `
            UPDATE "${props.name}"
            SET "${columnName}" = ${cell.toSqlValue()}
            WHERE ${primaryKeys.map((p) => `"${p.columnName}" = ${p.value}`).join(" AND ")};`;

          await database.execute(sqlStatement);
        }
      } finally {
        // We want to do this if the update fails or succeeds
        props.reload();
      }
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "VisualModeEnter",
    description: "Enter visual selection mode.",
    keybindExpression: "v",
    action() {
      setVisualModeStartCell(currentCell());

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

  useRegisterKeybindCommandOnMount({
    command: "SelectionReset",
    description: "Reset selected cells to their original values.",
    keybindExpression: "s > r",
    action() {
      const selection = visualSelection();
      selection.getAllIntersectingCells().forEach((c) => c.reset());
      selection.exit();
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "OpenCellEditor",
    description: "Open the cell editor for the current selection.",
    keybindExpression: "c",
    action() {
      props.onEditSelection?.(visualSelection());
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "MoveToTop",
    description: "Move to the last row of the table.",
    keybindExpression: "G",
    action: row.setToMax,
  });

  useRegisterKeybindCommandOnMount({
    command: "MoveDownHalf",
    description: "Move down by half a page.",
    keybindExpression: "Control + d",
    action() {
      row.increment(visibleRows);
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "MoveUpHalf",
    description: "Move up by half a page.",
    keybindExpression: "Control + u",
    action() {
      row.decrement(visibleRows);
    },
  });

  useRegisterKeybindCommandOnMount({
    command: "MoveToBottom",
    description: "Move to the first row of the table.",
    keybindExpression: "g",
    action: row.reset,
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

  return (
    <TableEditorContext.Provider
      value={{
        currentCell,
        visualSelection,
        getTable,
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
