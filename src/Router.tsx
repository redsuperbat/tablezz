import { createSignal, Match, Switch } from "solid-js";
import { createSolidContext } from "./createSolidContext";
import { useHopContext } from "./HopContext";
import { SqlQueryPage } from "./SqlQueryPage";
import { TablePage } from "./TablePage";

export const [RouteProvider, , useRouter] = createSolidContext(() => {
  const routes = ["table", "editor"] as const;
  type Route = (typeof routes)[number];
  const [route, setRoute] = createSignal<Route>("table");

  return { route, navigateTo: setRoute, routes };
});

export function Router() {
  const hopContext = useHopContext();

  const initialIndices = () => hopContext.position();

  return (
    <Switch>
      <Match when={hopContext.isEmpty()}>
        <TablePage
          initialColumnIndex={initialIndices()?.col}
          initialRowIndex={initialIndices()?.row}
        />
      </Match>
      <Match keyed when={hopContext.value().at(-1)}>
        {(hop) => (
          <SqlQueryPage
            query={hop.query}
            initialColumnIndex={initialIndices()?.col}
            initialRowIndex={initialIndices()?.row}
          />
        )}
      </Match>
    </Switch>
  );
}
