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
import { useRegisterKeybind } from "./keybinds/useRegisterKeybind";
import { cn } from "./lib/utils";
import { useRouter } from "./Router";
import { useTableContext } from "./TableProvider";
import { useDatabaseSchema } from "./useDatabaseSchema";

interface CommandPaletteItem {
	kind: string;
	onSelect(): void;
	searchTerm: string;
}

export function CommandPalette() {
	const { setTableName } = useTableContext();
	const { routes, navigateTo } = useRouter();
	const [open, setOpen] = useState(false);
	const databaseSchema = useDatabaseSchema();
	const [searchTerm, setSearchTerm] = useState<string>();
	const [selectedIndex, setSelectedIndex] = useState(0);

	const tables = useMemo(() => {
		return databaseSchema.data ?? [];
	}, [databaseSchema]);

	const items = useMemo((): CommandPaletteItem[] => {
		return [
			...tables.map((t) => ({
				kind: "table",
				searchTerm: t.table_name,
				onSelect() {
					setTableName(t.table_name);
				},
			})),
			...routes.map((r) => ({
				kind: "route",
				searchTerm: r,
				onSelect() {
					navigateTo(r);
				},
			})),
		];
	}, [tables, routes]);

	const filteredTables = useMemo(() => {
		const fuse = new Fuse(items, {
			keys: ["searchTerm"],
		});

		if (!searchTerm) {
			return items;
		}

		return fuse.search(searchTerm).map((r) => r.item);
	}, [items, searchTerm]);

	useEffect(() => {
		setSelectedIndex(0);
	}, [searchTerm]);

	useRegisterKeybind({
		name: "CommandPaletteShow",
		onTrigger: () => setOpen((o) => !o),
		keybindExpression: "Leader + Space",
	});

	useRegisterKeybind({
		name: "CommandPaletteSelect",
		onTrigger() {
			filteredTables[selectedIndex].onSelect?.();
			setOpen(false);
			setSearchTerm(undefined);
		},
		keybindExpression: "Enter",
	});

	useRegisterKeybind({
		name: "CommandPaletteSelectPrev",
		keybindExpression: "Control + k",
		onTrigger() {
			if (selectedIndex === 0) {
				return false;
			}
			setSelectedIndex((i) => i - 1);
		},
	});

	useRegisterKeybind({
		name: "CommandPaletteSelectNext",
		keybindExpression: "Control + j",
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
				aria-describedby="Command pallette"
			>
				<DialogHeader>
					<DialogTitle className="sr-only">Command palette</DialogTitle>
					<Input
						placeholder="Type something..."
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
							key={t.searchTerm}
						>
							{t.searchTerm}
						</div>
					))}
				</div>
			</DialogContent>
		</Dialog>
	);
}
