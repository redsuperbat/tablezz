import { cn } from "./lib/utils";
import { useTableItems } from "./useTableItems";
import { useTableStructure } from "./useTableStructure";

export function TableContent({ tableName }: { tableName: string }) {
  const items = useTableItems(tableName);
  const structure = useTableStructure(tableName);

  return (
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
          {items.data?.map((row) => (
            <tr key={JSON.stringify(row)}>
              {structure.data?.map((s) => (
                <td
                  className={cn("border border-gray-300 px-4 py-2 text-sm")}
                  key={JSON.stringify(s) + JSON.stringify(row)}
                >
                  <div className="truncate max-w-40 ">
                    {row[s.column_name as keyof typeof row]}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
