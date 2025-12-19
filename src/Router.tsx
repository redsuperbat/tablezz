import { createEffect, createSignal, Match, Switch } from "solid-js";
import { createSolidContext } from "./createSolidContext";
import { useHopContext } from "./HopContext";
import { SqlQueryPage } from "./SqlQueryPage";
import { usePickTable } from "./usePickTable";
import { useSelectedSchemaTables } from "./useSelectedSchemaTables";

export const [RouteProvider, , useRouter] = createSolidContext(() => {
  const routes = ["table", "editor"] as const;
  type Route = (typeof routes)[number];
  const [route, setRoute] = createSignal<Route>("table");

  return { route, navigateTo: setRoute, routes };
});

function InitialQuery() {
  const pickTable = usePickTable();
  const tablesQuery = useSelectedSchemaTables();

  createEffect(() => {
    const tables = tablesQuery.data;
    if (!tables || tables.length === 0) return;

    pickTable(tables.map((t) => t.tableName));
  });

  return null;
}

export function Router() {
  const hopContext = useHopContext();

  return (
    <Switch>
      <Match when={!hopContext.current()}>
        <InitialQuery />
      </Match>

      <Match keyed when={hopContext.current()}>
        {(hop) => (
          <SqlQueryPage
            query={hop.query}
            initialColumnIndex={hop.columnIndex}
            initialRowIndex={hop.rowIndex}
          />
        )}
      </Match>
    </Switch>
  );
}
