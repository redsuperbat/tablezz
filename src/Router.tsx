import { createSignal, Match, Switch } from "solid-js";
import { createWatcher } from "./commands/createWatcher";
import { createSolidContext } from "./createSolidContext";
import { useHopContext } from "./HopContext";
import { SqlQueryPage } from "./SqlQueryPage";

export const [RouteProvider, , useRouter] = createSolidContext(() => {
  const routes = ["table", "editor"] as const;
  type Route = (typeof routes)[number];
  const [route, setRoute] = createSignal<Route>("table");

  return { route, navigateTo: setRoute, routes };
});

export function Router() {
  const hopContext = useHopContext();

  createWatcher(hopContext.current, ({ next }) => {
    if (!next) {
    }
  });

  return (
    <Switch>
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
