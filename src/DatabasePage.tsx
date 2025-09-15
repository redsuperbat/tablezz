import { useState } from "react";
import { useTableContext } from "./TableProvider";
import { useDatabaseSchema } from "./useDatabaseSchema";
import { useTableContent } from "./useTableContent";
import { useTableStructure } from "./useTableStructure";

function Table({ tableName }: { tableName: string }) {
	return <div>{tableName}</div>;
}

function Schema({
	onSelectTable,
}: {
	onSelectTable: (tableName: string) => void;
}) {
	const databaseSchema = useDatabaseSchema();

	return (
		<div className="flex flex-col gap-2 items-start">
			<h2 className="font-bold">Tables</h2>
			{databaseSchema.data?.map((table) => (
				<button onClick={() => onSelectTable(table.table_name)}>
					<Table key={table.table_name} tableName={table.table_name}></Table>
				</button>
			))}
		</div>
	);
}

function TableContent({ tableName }: { tableName: string }) {
	const content = useTableContent(tableName);
	const structure = useTableStructure(tableName);

	return (
		<div className="overflow-scroll font-normal text-start">
			<table className="border-separate border-spacing-x-4">
				<thead>
					<tr>
						{structure.data?.map((s) => (
							<th className="p" key={s.column_name}>
								{s.column_name}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{content.data?.map((row) => (
						<tr key={JSON.stringify(row)}>
							{structure.data?.map((s, i) => (
								<td key={row[s.column_name] + i}>
									<div className="truncate max-w-40">{row[s.column_name]}</div>
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

export function DatabasePage() {
	const { tableName, setTableName } = useTableContext();

	return (
		<main
			className="grid gap-3 h-screen w-screen p-5"
			style={{ gridTemplateColumns: "auto 1fr" }}
		>
			<Schema onSelectTable={setTableName} />
			{tableName && <TableContent tableName={tableName} />}
		</main>
	);
}
