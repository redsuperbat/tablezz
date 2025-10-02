import { useTableRows } from "@/useTableRows";
import { TableEditorProvider } from "./TableEditorProvider";
import { TableRow } from "./TableRow";

export function Table({ tableName }: { tableName: string }) {
  const rows = useTableRows(tableName);

  const structure = Object.keys(rows.data?.at(0) ?? {}).map((k) => ({
    columnName: k,
    dataType: "text" as const,
  }));

  return (
    <TableEditorProvider>
      <div className="overflow-scroll h-full font-normal text-start">
        <table className="border-spacing-x-4 table-auto border-collapse border border-gray-300 w-full text-sm">
          <thead>
            <tr>
              {structure.map((s) => (
                <th
                  className="border border-gray-300 px-4 py-2"
                  key={s.columnName}
                >
                  {s.columnName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.data?.map((row, rowIndex) => {
              return (
                <TableRow
                  rowIndex={rowIndex}
                  key={JSON.stringify(row)}
                  row={row}
                  structure={structure}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </TableEditorProvider>
  );
}
