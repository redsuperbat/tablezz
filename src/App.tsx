import { useState } from "react";
import { Button } from "./components/ui/button";
import { DatabasePage } from "./DatabasePage";
import { databaseCredentials } from "./databaseCredentials";
import { SchemaProvider } from "./SchemaProvider";

export function App() {
	const [url, setUrl] = useState<string>();

	if (!databaseCredentials.get()) {
		return (
			<div>
				<h1>Input database url</h1>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						if (!url) return;
						databaseCredentials.set(url);
					}}
				>
					<input type="text" onChange={(e) => setUrl(e.target.value)} />
					<Button type="submit">Submit</Button>
				</form>
			</div>
		);
	}

	return (
		<SchemaProvider schemaName="public">
			<DatabasePage />
		</SchemaProvider>
	);
}
