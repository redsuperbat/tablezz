import { useCallback, useEffect, useMemo, useRef } from "react";
import { useConfig } from "@/config/ConfigurationProvider";
import { createReactContext } from "@/createReactContext";
import { KeybindChecker, type KeyEvent } from "./KeybindChecker";
import { KeybindLeaderTracker } from "./KeybindLeaderTracker";
import { KeybindParser } from "./KeybindParser";
import { KeybindTokenizer } from "./KeybindTokenizer";
import type { Keybind } from "./useRegisterKeybind";

interface RegisteredKeybind extends Keybind {
  check: (e: KeyEvent) => boolean;
}

export const [KeybindProvider, , useKeybindContext] = createReactContext(() => {
  const config = useConfig();
  const keybinds = useRef<{ [name: string]: RegisteredKeybind }>({});

  const leaderTracker = useMemo(
    () =>
      new KeybindLeaderTracker(
        config.get("leaderKeyTimeoutMs"),
        config.get("leaderKey"),
      ),
    [config],
  );

  const createChecker = useCallback(
    (hotkeyExpression: string) => {
      const tokens = new KeybindTokenizer(hotkeyExpression).tokenize();
      const ast = new KeybindParser(tokens).parseKeyExpression();

      return (e: KeyEvent) => new KeybindChecker(e, leaderTracker).check(ast);
    },
    [leaderTracker],
  );

  const register = useCallback(
    (key: Keybind) => {
      keybinds.current[key.name] = {
        ...key,
        check: createChecker(key.keybindExpression),
      };
    },
    [createChecker],
  );

  useEffect(() => {
    function checkAndExecute(e: KeyboardEvent) {
      const isInvalidTarget =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement;

      for (const bind of Object.values(keybinds.current)) {
        if (!bind.check(e)) continue;

        if (isInvalidTarget && !bind.overrideInput) continue;

        bind.onTrigger(e);
      }
    }

    window.addEventListener("keyup", checkAndExecute);
    return () => window.removeEventListener("keyup", checkAndExecute);
  }, []);

  return {
    keybinds: () => keybinds.current,
    leaderTracker,
    register,
  };
});
