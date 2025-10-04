import { useCallback, useEffect, useMemo, useRef } from "react";
import { useCommandsContext } from "@/commands/CommandsContext";
import { useConfig } from "@/config/ConfigurationProvider";
import { createReactContext } from "@/createReactContext";
import type { Keybind } from "./Keybind";
import { KeybindChecker, type KeyEvent } from "./KeybindChecker";
import { KeybindLeaderTracker } from "./KeybindLeaderTracker";
import { KeybindParser } from "./KeybindParser";
import { KeybindTokenizer } from "./KeybindTokenizer";

interface RegisteredKeybind extends Keybind {
  check: (e: KeyEvent) => boolean;
  disabled?: boolean;
}

interface RegisterKeybind extends Keybind {
  disabled?: boolean;
}

export const [KeybindProvider, , useKeybindContext] = createReactContext(() => {
  const config = useConfig();
  const commandsContext = useCommandsContext();
  const keybinds = useRef<Map<string, RegisteredKeybind>>(new Map());

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

  const registerKeybind = useCallback(
    (key: RegisterKeybind) => {
      const cacheKey = key.command + key.keybindExpression;
      // The map serves as a de-duplication of keybinds
      // causing the checkers to stay up to date
      keybinds.current.set(cacheKey, {
        command: key.command,
        overrideInput: key.overrideInput,
        keybindExpression: key.keybindExpression,
        disabled: key.disabled,
        check: createChecker(key.keybindExpression),
      });
    },
    [createChecker],
  );

  useEffect(() => {
    const configurationKeybinds = Object.entries(config.get("keybindings"));

    for (const [keybindExpression, command] of configurationKeybinds) {
      registerKeybind({ command, keybindExpression });
    }
  }, [config, registerKeybind]);

  useEffect(() => {
    function checkAndTrigger(e: KeyboardEvent) {
      const isInvalidTarget =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement;

      for (const bind of [...keybinds.current.values()].reverse()) {
        if (bind.disabled) continue;
        if (!bind.check(e)) continue;
        console.log(bind, e);

        // If the target element is an input element we skip triggering
        // the keybind. Unless the keybind specifically override it
        if (isInvalidTarget && !bind.overrideInput) continue;

        e.preventDefault();
        e.stopPropagation();
        commandsContext.triggerCommand(bind.command);

        // Only trigger a single binding.
        // We cannot map a single keybind to trigger multiple things
        break;
      }
    }

    window.addEventListener("keydown", checkAndTrigger);
    return () => window.removeEventListener("keydown", checkAndTrigger);
  }, [commandsContext.triggerCommand]);

  return {
    keybinds: () => keybinds.current,
    leaderTracker,
    registerKeybind,
  };
});
