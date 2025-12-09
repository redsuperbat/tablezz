import { createSignal, Match, Switch } from "solid-js";
import z from "zod";
import { useRegisterCommandOnMount } from "./commands/useRegisterCommand";
import { createSolidContext } from "./createSolidContext";
import { useEditor } from "./editor/useEditor";
import { useManualQueryContext } from "./ManualQueryContext";
import { SqlQueryPage } from "./SqlQueryPage";
import { TablePage } from "./TablePage";

export const [RouteProvider, , useRouter] = createSolidContext(() => {
  const routes = ["table", "editor"] as const;
  type Route = (typeof routes)[number];
  const [route, setRoute] = createSignal<Route>("table");

  return { route, navigateTo: setRoute, routes };
});

export function Router() {
  const editor = useEditor();
  const manualQuery = useManualQueryContext();

  useRegisterCommandOnMount({
    command: "SqlQuery",
    description: "Run a custom SQL query and display the results.",
    actionArgs: [z.string().min(1).meta({ title: "<sql>" }).optional()],
    async action(sql) {
      if (sql === undefined) {
        sql = await editor.open({
          initialContent: "",
          extension: ".sql",
        });
      }

      manualQuery.add(sql);
    },
  });

  return (
    <Switch>
      <Match when={manualQuery.isEmpty()}>
        <TablePage />
      </Match>
      <Match when={manualQuery.value().at(-1)}>
        {(query) => <SqlQueryPage query={query()} />}
      </Match>
    </Switch>
  );
}
