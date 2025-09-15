import { useCallback, useMemo } from "react";
import { HotkeyChecker } from "./HotkeyChecker";
import { HotkeyParser } from "./HotkeyParser";
import { HotkeyTokenizer } from "./HotkeyTokenizer";

export function useHotkeyChecker(hotkeyExpression: string) {
	const ast = useMemo(() => {
		const tokens = new HotkeyTokenizer(hotkeyExpression).tokenize();
		return new HotkeyParser(tokens).parseKeyExpression();
	}, [hotkeyExpression]);

	return useCallback(
		(e: KeyboardEvent) => {
			const result = new HotkeyChecker(e).check(ast);
			return result;
		},
		[ast],
	);
}
