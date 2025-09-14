import Fuse from "fuse.js";
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Input } from "./components/ui/input";
import { cn } from "./lib/utils";
import { useDatabaseSchema } from "./useDatabaseSchema";
import { useRegisterKeybind } from "./useRegisterKeybind";

export function CommandPalette() {
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
		defaultTrigger: (e) => {
			return e.metaKey && e.key === "k";
		},
	});

	useRegisterKeybind({
		name: "CommandPaletteSelect",
		onTrigger() {},
		defaultTrigger: "Enter",
	});

	useRegisterKeybind({
		name: "CommandPaletteSelectPrev",
		defaultTrigger: (e) => e.ctrlKey && e.key === "k",
		onTrigger() {
			if (selectedIndex === 0) {
				return false;
			}
			setSelectedIndex((i) => i - 1);
		},
	});

	useRegisterKeybind({
		name: "CommandPaletteSelectNext",
		defaultTrigger: (e) => e.ctrlKey && e.key === "j",
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
				className="min-h-96 flex flex-col justify-start"
				showCloseButton={false}
			>
				<DialogHeader>
					<Input
						autoFocus
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
					/>
				</DialogHeader>
				<div>
					{filteredTables.map((t, i) => (
						<div
							className={cn(i === selectedIndex && "font-bold")}
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
