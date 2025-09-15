import { cn } from "./lib/utils";
import { useTableContext } from "./TableProvider";
import { useDatabaseSchema } from "./useDatabaseSchema";
import { useTableContent } from "./useTableContent";
import { useTableStructure } from "./useTableStructure";

function Table({ tableName }: { tableName: string }) {
	return <div>{tableName}</div>;
}

function Schema({
	onSelectTable,
	tableName,
}: {
	onSelectTable: (tableName: string) => void;
	tableName?: string;
}) {
	const databaseSchema = useDatabaseSchema();

	return (
		<div className="flex flex-col gap-2 items-start">
			<h2 className="font-bold">Tables</h2>
			{databaseSchema.data?.map((table) => (
				<button
					key={table.table_name}
					className={cn(
						"hover:underline cursor-pointer",
						table.table_name === tableName && "font-bold",
					)}
					onClick={() => onSelectTable(table.table_name)}
				>
					<Table tableName={table.table_name}></Table>
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
			<table className="border-spacing-x-4 table-auto border-collapse border border-gray-300 w-full text-sm">
				<thead>
					<tr>
						{structure.data?.map((s) => (
							<th
								className="border border-gray-300 px-4 py-2"
								key={s.column_name}
							>
								{s.column_name}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{content.data?.map((row) => (
						<tr key={JSON.stringify(row)}>
							{structure.data?.map((s) => (
								<td
									className={cn("border border-gray-300 px-4 py-2 text-sm")}
									key={JSON.stringify(s) + JSON.stringify(row)}
								>
									<div className="truncate max-w-40 ">
										{row[s.column_name as keyof typeof row]}
									</div>
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
			<Schema tableName={tableName} onSelectTable={setTableName} />
			{tableName && <TableContent tableName={tableName} />}
		</main>
	);
}
