import { useMemo, useState } from "react";
import { createSolidContext } from "./createReactContext";
import { DatabasePage } from "./DatabasePage";

export const [RouteProvider, , useRouter] = createSolidContext(() => {
  const routes = useMemo(() => ["database", "settings"], []);
  type Route = (typeof routes)[number];
  const [route, setRoute] = useState<Route>("database");

  return { route, navigateTo: setRoute, routes };
});

export function Router() {
  const { route } = useRouter();

  switch (route) {
    case "database":
      return <DatabasePage />;
  }
}
