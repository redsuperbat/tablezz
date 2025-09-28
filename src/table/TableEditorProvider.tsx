import { createContext, type ReactNode, useContext, useState } from "react";
import { useRegisterKeybind } from "@/keybinds/useRegisterKeybind";

interface TableEditorContext {
  column: number;
  row: number;
}

const TableEditorContext = createContext<TableEditorContext | null>(null);

export function TableEditorProvider({ children }: { children: ReactNode }) {
  const [ctx, setCtx] = useState<TableEditorContext>({ column: 0, row: 0 });

  useRegisterKeybind({
    name: "MoveCellRight",
    keybindExpression: "l",
    onTrigger() {
      setCtx((c) => ({ ...c, column: c.column + 1 }));
    },
  });

  useRegisterKeybind({
    name: "MoveCellLeft",
    keybindExpression: "h",
    onTrigger() {
      setCtx((c) => ({ ...c, column: c.column - 1 }));
    },
  });

  useRegisterKeybind({
    name: "MoveCellUp",
    keybindExpression: "k",
    onTrigger() {
      setCtx((c) => ({ ...c, row: c.row - 1 }));
    },
  });

  useRegisterKeybind({
    name: "MoveCellDown",
    keybindExpression: "j",
    onTrigger() {
      setCtx((c) => ({ ...c, row: c.row + 1 }));
    },
  });

  return (
    <TableEditorContext.Provider value={ctx}>
      {children}
    </TableEditorContext.Provider>
  );
}

export function useTableEditorContext() {
  const ctx = useContext(TableEditorContext);
  if (!ctx) {
    throw new Error("no context found");
  }
  return ctx;
}
