import { useCallback, useMemo } from "react";
import { KeybindChecker } from "./KeybindChecker";
import { KeybindLeaderTracker } from "./KeybindLeaderTracker";
import { KeybindParser } from "./KeybindParser";
import { KeybindTokenizer } from "./KeybindTokenizer";

export function useKeybindChecker(hotkeyExpression: string) {
	// We only ever want one instance
	const leaderTracker = useMemo(
		() => new KeybindLeaderTracker(1000, "Space"),
		[],
	);

	const ast = useMemo(() => {
		const tokens = new KeybindTokenizer(hotkeyExpression).tokenize();
		return new KeybindParser(tokens).parseKeyExpression();
	}, [hotkeyExpression]);

	return useCallback(
		(e: KeyboardEvent) => new KeybindChecker(e, leaderTracker).check(ast),
		[ast],
	);
}
