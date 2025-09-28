import { useSelectedTableContext } from "@/TableProvider";
import { useTableStructure } from "@/useTableStructure";
import { TableCell } from "./TableCell";

export function TableRow({ row }: { row: object }) {
  const { selectedTable } = useSelectedTableContext();
  const structure = useTableStructure(selectedTable);

  return (
    <tr key={JSON.stringify(row)}>
      {structure.data?.map((s, index) => (
        <TableCell
          key={JSON.stringify(index) + JSON.stringify(row)}
          dataType={s.data_type}
          data={row[s.column_name as keyof typeof row]}
        />
      ))}
    </tr>
  );
}
