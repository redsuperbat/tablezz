import { CommandPalette } from "./CommandPalette";
import { DatabaseConnectionCredentials } from "./DatabaseConnectinCredentials";
import { DatabasePage } from "./DatabasePage";
import { databaseCredentials } from "./databaseCredentials";
import { SchemaProvider } from "./SchemaProvider";

export function App() {
	if (!databaseCredentials.get()) {
		return <DatabaseConnectionCredentials />;
	}

	return (
		<SchemaProvider schemaName="public">
			<CommandPalette />
			<DatabasePage />
		</SchemaProvider>
	);
}
