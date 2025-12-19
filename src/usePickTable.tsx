import { Table } from "lucide-solid";
import { useHopContext } from "./HopContext";
import { usePicker } from "./picker/usePicker";
import { useSchemaContext } from "./SchemaProvider";

export function usePickTable() {
  const picker = usePicker();
  const hopContext = useHopContext();
  const { schema } = useSchemaContext();

  return async function pickTable(tables: string[]) {
    const table = await picker.open({
      items: tables.map((t) => ({
        value: t,
        label: t,
        icon: <Table />,
      })),
    });

    if (!table) {
      return pickTable(tables);
    }

    hopContext.add({
      query: `SELECT * FROM "${schema()}"."${table}" LIMIT 100;`,
    });
  };
}
