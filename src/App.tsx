import { CommandPalette } from "./CommandPalette";
import { RouteProvider, Router } from "./Router";
import { SchemaProvider } from "./SchemaProvider";
import { TableProvider } from "./TableProvider";

export function App() {
	return (
		<RouteProvider>
			<SchemaProvider schemaName="public">
				<TableProvider>
					<CommandPalette />
					<Router />
				</TableProvider>
			</SchemaProvider>
		</RouteProvider>
	);
}
