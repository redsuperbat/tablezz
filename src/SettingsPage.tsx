import { Editor } from "@monaco-editor/react";

export function SettingsPage() {
	function handleEditorChange(value, event) {
		console.log("here is the current model value:", value);
	}

	return (
		<Editor
			height="90vh"
			defaultLanguage="yaml"
			defaultValue="databaseUrl:"
			onChange={handleEditorChange}
		/>
	);
}
