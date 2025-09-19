import { useCallback, useMemo } from "react";
import { HotkeyChecker } from "./HotkeyChecker";
import { HotkeyLeaderTracker } from "./HotkeyLeaderTracker";
import { HotkeyParser } from "./HotkeyParser";
import { HotkeyTokenizer } from "./HotkeyTokenizer";

export function useHotkeyChecker(hotkeyExpression: string) {
	const leaderTracker = useMemo(() => new HotkeyLeaderTracker(), []);
	const ast = useMemo(() => {
		const tokens = new HotkeyTokenizer(hotkeyExpression).tokenize();
		return new HotkeyParser(tokens).parseKeyExpression();
	}, [hotkeyExpression]);

	return useCallback(
		(e: KeyboardEvent) =>
			new HotkeyChecker(e, leaderTracker, "Space").check(ast),
		[ast],
	);
}
