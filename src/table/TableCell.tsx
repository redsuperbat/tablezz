import { cn } from "@/lib/utils";
import type { PostgresDataType } from "@/useTableStructure";

function TableCellDataType({
  data,
  dataType,
}: {
  data: unknown;
  dataType: PostgresDataType;
}) {
  switch (dataType) {
    default:
      return <div>{String(data)}</div>;
  }
}

export function TableCell({
  data,
  dataType,
}: {
  data: unknown;
  dataType: PostgresDataType;
}) {
  return (
    <td className={cn("border border-gray-300 px-4 py-2 text-sm")}>
      <TableCellDataType data={data} dataType={dataType} />
    </td>
  );
}
