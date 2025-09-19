import { Toaster } from "@/components/ui/sonner";
import { CommandPalette } from "./CommandPalette";
import { ConfigurationProvider } from "./config/ConfigurationProvider";
import { RouteProvider, Router } from "./Router";
import { SchemaProvider } from "./SchemaProvider";
import { TableProvider } from "./TableProvider";

export function App() {
	return (
		<>
			<ConfigurationProvider>
				<RouteProvider>
					<SchemaProvider schemaName="public">
						<TableProvider>
							<CommandPalette />
							<Router />
						</TableProvider>
					</SchemaProvider>
				</RouteProvider>
			</ConfigurationProvider>
			<Toaster />
		</>
	);
}
