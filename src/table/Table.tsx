import { useTableRows } from "@/useTableRows";
import { useTableStructure } from "@/useTableStructure";
import { TableEditorProvider } from "./TableEditorProvider";
import { TableRow } from "./TableRow";

export function Table({ tableName }: { tableName: string }) {
  const items = useTableRows(tableName);
  const structure = useTableStructure(tableName);

  return (
    <TableEditorProvider>
      <div className="overflow-scroll h-full font-normal text-start">
        <table className="border-spacing-x-4 table-auto border-collapse border border-gray-300 w-full text-sm">
          <thead>
            <tr>
              {structure.data?.map((s) => (
                <th
                  className="border border-gray-300 px-4 py-2"
                  key={s.column_name}
                >
                  {s.column_name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.data?.map((row, rowIndex) => (
              <TableRow
                rowIndex={rowIndex}
                key={JSON.stringify(row)}
                row={row}
              />
            ))}
          </tbody>
        </table>
      </div>
    </TableEditorProvider>
  );
}
