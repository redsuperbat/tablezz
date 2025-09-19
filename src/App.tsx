import { Toaster } from "@/components/ui/sonner";
import { CommandPalette } from "./CommandPalette";
import { ConfigurationProvider } from "./config/ConfigurationProvider";
import { QueryHistoryProvider } from "./database/QueryHistoryProvider";
import { RouteProvider, Router } from "./Router";
import { SchemaProvider } from "./SchemaProvider";
import { SuspenseBoundary } from "./SuspenseBoundary";
import { TableProvider } from "./TableProvider";

export function App() {
	return (
		<SuspenseBoundary>
			<QueryHistoryProvider>
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
			</QueryHistoryProvider>
			<Toaster />
		</SuspenseBoundary>
	);
}
