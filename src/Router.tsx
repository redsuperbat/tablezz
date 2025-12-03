import { createSignal, Match, Switch } from "solid-js";
import z from "zod";
import { useRegisterCommandOnMount } from "./commands/useRegisterCommand";
import { createSolidContext } from "./createSolidContext";
import { useRegisterKeybindCommand } from "./keybinds/useRegisterKeybindCommand";
import { SqlQueryPage } from "./SqlQueryPage";
import { TablePage } from "./TablePage";

export const [RouteProvider, , useRouter] = createSolidContext(() => {
  const routes = ["table", "editor"] as const;
  type Route = (typeof routes)[number];
  const [route, setRoute] = createSignal<Route>("table");

  return { route, navigateTo: setRoute, routes };
});

export function Router() {
  const [manualQuery, setManualQuery] = createSignal<string>();
  const registerKeybindCommand = useRegisterKeybindCommand();

  useRegisterCommandOnMount({
    command: "SqlQuery",
    description: "Run a custom SQL query and display the results.",
    actionArgs: [z.string().min(1).meta({ title: "<sql>" })],
    action(sql) {
      const disposable = registerKeybindCommand({
        command: "SqlQueryReset",
        description: "Clear the current SQL query and return to table view.",
        keybindExpression: "Escape",
        action() {
          disposable.dispose();
          setManualQuery(undefined);
        },
      });
      setManualQuery(sql);
    },
  });

  return (
    <Switch>
      <Match when={!manualQuery()}>
        <TablePage />
      </Match>
      <Match when={manualQuery()}>
        {(query) => <SqlQueryPage query={query()} />}
      </Match>
    </Switch>
  );
}
