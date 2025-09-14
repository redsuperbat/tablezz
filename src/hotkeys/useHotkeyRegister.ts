import { useCallback } from "react";
import { HotkeyBinder } from "./HotkeyBinder";
import { HotkeyParser } from "./HotkeyParser";
import { HotkeyTokenizer } from "./HotkeyTokenizer";

export function useHotkeyRegister() {
	return useCallback(
		(hotkeyExpression: string, handler: (e: KeyboardEvent) => void) => {
			const tokens = new HotkeyTokenizer(hotkeyExpression).tokenize();
			const ast = new HotkeyParser(tokens).parse();
			return new HotkeyBinder(ast, handler).register();
		},
		[],
	);
}
