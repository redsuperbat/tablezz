import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import Fuse from "fuse.js";
import { useEffect, useMemo, useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "./components/ui/input";
import { cn } from "./lib/utils";
import { useTableContext } from "./TableProvider";
import { useDatabaseSchema } from "./useDatabaseSchema";
import { useRegisterKeybind } from "./useRegisterKeybind";

export function CommandPalette() {
	const { setTableName } = useTableContext();
	const [open, setOpen] = useState(false);
	const databaseSchema = useDatabaseSchema();
	const [searchTerm, setSearchTerm] = useState<string>();
	const [selectedIndex, setSelectedIndex] = useState(0);

	const tables = useMemo(() => {
		return databaseSchema.data ?? [];
	}, [databaseSchema]);

	const filteredTables = useMemo(() => {
		const fuse = new Fuse(tables, {
			keys: ["table_name"],
		});

		if (!searchTerm) {
			return tables;
		}

		return fuse.search(searchTerm).map((r) => r.item);
	}, [tables, searchTerm]);

	useEffect(() => {
		setSelectedIndex(0);
	}, [searchTerm]);

	useRegisterKeybind({
		name: "CommandPaletteShow",
		onTrigger: () => setOpen((o) => !o),
		defaultTrigger: "Meta + k",
	});

	useRegisterKeybind({
		name: "CommandPaletteSelect",
		onTrigger() {
			setTableName(filteredTables[selectedIndex].table_name);
			setOpen(false);
			setSearchTerm(undefined);
		},
		defaultTrigger: "Enter",
	});

	useRegisterKeybind({
		name: "CommandPaletteSelectPrev",
		defaultTrigger: "Control + k",
		onTrigger() {
			if (selectedIndex === 0) {
				return false;
			}
			setSelectedIndex((i) => i - 1);
		},
	});

	useRegisterKeybind({
		name: "CommandPaletteSelectNext",
		defaultTrigger: "Control + j",
		onTrigger() {
			if (selectedIndex === filteredTables.length - 1) {
				return false;
			}
			setSelectedIndex((i) => i + 1);
		},
	});

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent
				className="h-96 flex flex-col justify-start overflow-y-auto"
				showCloseButton={false}
			>
				<DialogHeader>
					<VisuallyHidden>
						<DialogTitle>Combobox</DialogTitle>
					</VisuallyHidden>
					<Input
						autoFocus
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
					/>
				</DialogHeader>
				<div>
					{filteredTables.map((t, i) => (
						<div
							className={cn(
								i === selectedIndex && "bg-gray-100",
								"p-1 rounded",
							)}
							key={t.table_name}
						>
							{t.table_name}
						</div>
					))}
				</div>
			</DialogContent>
		</Dialog>
	);
}
