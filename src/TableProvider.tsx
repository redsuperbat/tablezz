import { useState } from "react";
import { createReactContext } from "./createReactContext";

export const [TableProvider, , useTableContext] = createReactContext(() => {
	const [tableName, setTableName] = useState<string>();
	return { tableName, setTableName };
});
