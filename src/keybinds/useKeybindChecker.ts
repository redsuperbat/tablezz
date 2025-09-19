import { useCallback, useMemo } from "react";
import { useConfig } from "@/config/ConfigurationProvider";
import { KeybindChecker } from "./KeybindChecker";
import { KeybindLeaderTracker } from "./KeybindLeaderTracker";
import { KeybindParser } from "./KeybindParser";
import { KeybindTokenizer } from "./KeybindTokenizer";

export function useKeybindChecker(hotkeyExpression: string) {
	const config = useConfig();
	// We only ever want one instance
	const leaderTracker = useMemo(
		() =>
			new KeybindLeaderTracker(
				config.get("leaderKeyTimeoutMs"),
				config.get("leaderKey"),
			),
		[config],
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
