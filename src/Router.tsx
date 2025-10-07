import { createSignal } from "solid-js";
import { createSolidContext } from "./createReactContext";
import { DatabasePage } from "./DatabasePage";

export const [RouteProvider, , useRouter] = createSolidContext(() => {
  const routes = ["database"];
  type Route = (typeof routes)[number];
  const [route, setRoute] = createSignal<Route>("database");

  return { route, navigateTo: setRoute, routes };
});

export function Router() {
  const { route } = useRouter();

  switch (route()) {
    case "database":
      return <DatabasePage />;
  }
}
