import { Table } from "lucide-solid";
import { message } from "./commands/Messages";
import { useHopContext } from "./HopContext";
import { usePicker } from "./picker/usePicker";
import { useSchemaContext } from "./SchemaProvider";
import { useSelectedSchemaTables } from "./useSelectedSchemaTables";

export function usePickTable() {
  const picker = usePicker();
  const hopContext = useHopContext();

  const tablesQuery = useSelectedSchemaTables();

  const { schema } = useSchemaContext();

  return async function pickTable() {
    const tables = tablesQuery.data;

    if (!tables || tables.length === 0) return;

    const table = await picker.open({
      items: tables.map((t) => ({
        value: t.tableName,
        label: t.tableName,
        icon: <Table />,
      })),
    });

    if (!table) {
      return message.info("No table selected");
    }

    hopContext.add({
      query: `SELECT * FROM "${schema()}"."${table}" LIMIT 100;`,
    });
  };
}
