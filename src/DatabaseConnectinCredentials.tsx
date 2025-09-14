import { useState } from "react";
import { Button } from "./components/ui/button";
import { databaseCredentials } from "./databaseCredentials";

export function DatabaseConnectionCredentials() {
	const [url, setUrl] = useState<string>();
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
