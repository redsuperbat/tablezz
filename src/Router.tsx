import { useMemo, useState } from "react";
import { createReactContext } from "./createReactContext";
import { DatabasePage } from "./DatabasePage";
import { SettingsPage } from "./SettingsPage";

export const [RouteProvider, , useRouter] = createReactContext(() => {
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
		case "settings":
			return <SettingsPage />;
	}
}
