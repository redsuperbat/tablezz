import { createEffect, createSignal, Match, Switch } from "solid-js";
import { createSolidContext } from "./createSolidContext";
import { useHopContext } from "./HopContext";
import { MessagesPage } from "./MessagesPage";
import { SqlQueryPage } from "./SqlQueryPage";
import { usePickTable } from "./usePickTable";

export const MESSAGES_QUERY = "__messages__";

export const [RouteProvider, , useRouter] = createSolidContext(() => {
  const routes = ["table", "editor"] as const;
  type Route = (typeof routes)[number];
  const [route, setRoute] = createSignal<Route>("table");

  return { route, navigateTo: setRoute, routes };
});

function InitialQuery() {
  const pickTable = usePickTable();

  createEffect(() => {
    pickTable();
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

      <Match when={hopContext.current()?.query === MESSAGES_QUERY}>
        <MessagesPage />
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
