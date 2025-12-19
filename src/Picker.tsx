import { Database, Folder, Link } from "lucide-solid";
import z from "zod";
import { useConnectionCredentials } from "./ConnectionCredentialsProvider";
import { useRegisterKeybindCommandOnMount } from "./keybinds/useRegisterKeybindCommand";
import { type PickerItem, usePicker } from "./picker/usePicker";
import { useSchemaContext } from "./SchemaProvider";
import { useDatabases } from "./useDatabases";
import { usePickTable } from "./usePickTable";
import { useSelectedDatabaseSchemas } from "./useSelectedDatabaseSchemas";

export function Picker() {
  const selectedSchemas = useSelectedDatabaseSchemas();
  const { setSchema } = useSchemaContext();
  const databases = useDatabases();
  const { savedUrls, setActiveUrl, url } = useConnectionCredentials();
  const picker = usePicker();
  const pickTable = usePickTable();

  const schemas = () => selectedSchemas.data ?? [];
  const databasesList = () => databases.data ?? [];
  const urlsList = () => savedUrls() ?? [];

  useRegisterKeybindCommandOnMount({
    command: "PickerOpen",
    description: "Open the picker to pick items",
    keybindExpression: "Leader > Space",
    actionArgs: [
      z
        .enum(["schemas", "databases", "urls", "tables"])
        .default("tables")
        .meta({ title: "<type>" }),
    ],
    async action(type) {
      switch (type) {
        case "schemas": {
          const items: PickerItem<string>[] = schemas().map((s) => ({
            value: s.schemaName,
            label: s.schemaName,
            icon: <Folder />,
          }));
          const selected = await picker.open({ items });
          if (selected) {
            setSchema(selected);
          }
          break;
        }

        case "databases": {
          const items: PickerItem<string>[] = databasesList().map((d) => ({
            value: d.databaseName,
            label: d.databaseName,
            icon: <Database />,
          }));
          const selected = await picker.open({ items });
          if (selected) {
            const currentUrl = new URL(url());
            currentUrl.pathname = `/${selected}`;
            setActiveUrl(currentUrl.toString());
          }
          break;
        }

        case "tables": {
          pickTable();
          break;
        }

        case "urls": {
          const items: PickerItem<string>[] = urlsList().map((u) => {
            const parsed = new URL(u);
            const displayName = `${parsed.host}${parsed.pathname}`;
            return {
              value: u,
              label: displayName,
              icon: <Link />,
            };
          });
          const selected = await picker.open({ items });
          if (selected) {
            setActiveUrl(selected);
          }
          break;
        }
      }
    },
  });

  return null;
}
