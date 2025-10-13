import { createSignal, Match, Switch } from "solid-js";
import { createSolidContext } from "./createSolidContext";
import { EditorPage } from "./EditorPage";
import { useRegisterKeybindCommand } from "./keybinds/useRegisterKeybindCommand";
import { TablePage } from "./TablePage";

export const [RouteProvider, , useRouter] = createSolidContext(() => {
  const routes = ["table", "editor"] as const;
  type Route = (typeof routes)[number];
  const [route, setRoute] = createSignal<Route>("table");

  return { route, navigateTo: setRoute, routes };
});

export function Router() {
  const { route, navigateTo } = useRouter();

  useRegisterKeybindCommand({
    command: "ToggleSqlEditor",
    keybindExpression: "Leader + s",
    action() {
      navigateTo("editor");
    },
  });

  return (
    <Switch>
      <Match when={route() === "table"}>
        <TablePage />
      </Match>
      <Match when={route() === "editor"}>
        <EditorPage />
      </Match>
    </Switch>
  );
}
