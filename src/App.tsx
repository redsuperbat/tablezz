import { CommandPalette } from "./CommandPalette";
import { DatabaseConnectionCredentials } from "./DatabaseConnectinCredentials";
import { DatabasePage } from "./DatabasePage";
import { databaseCredentials } from "./databaseCredentials";
import { SchemaProvider } from "./SchemaProvider";
import { TableProvider } from "./TableProvider";

export function App() {
	if (!databaseCredentials.get()) {
		return <DatabaseConnectionCredentials />;
	}

	return (
		<SchemaProvider schemaName="public">
			<TableProvider>
				<CommandPalette />
				<DatabasePage />
			</TableProvider>
		</SchemaProvider>
	);
}
