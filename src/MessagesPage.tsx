import { message } from "./commands/Messages";
import { DataTable } from "./table/DataTable";
import { DataTableProvider } from "./table/DataTableProvider";

export function MessagesPage() {
  const rows = () =>
    message.getHistory().map((m) => ({
      time: m.timestamp.toLocaleTimeString(),
      type: m.type,
      message: m.text,
    }));

  const structure = () => [
    {
      columnName: "time",
      dataType: "text" as const,
      isPrimary: false,
      foreignKey: null,
      isNullable: false,
    },
    {
      columnName: "type",
      dataType: "text" as const,
      isPrimary: false,
      foreignKey: null,
      isNullable: false,
    },
    {
      columnName: "message",
      dataType: "text" as const,
      isPrimary: false,
      foreignKey: null,
      isNullable: false,
    },
  ];

  return (
    <div class="grid h-full overflow-hidden">
      <DataTableProvider
        reload={() => {}}
        structure={structure()}
        rows={rows()}
        tableName="messages"
        initialRowIndex={undefined}
        initialColumnIndex={undefined}
      >
        <DataTable reload={() => {}} />
      </DataTableProvider>
    </div>
  );
}
