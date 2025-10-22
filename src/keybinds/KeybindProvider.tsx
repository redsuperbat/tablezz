import { createSignal, onMount } from "solid-js";
import { useCommandsContext } from "@/commands/CommandsContext";
import { useConfig } from "@/config/ConfigurationProvider";
import { createSolidContext } from "@/createSolidContext";
import type { Keybind } from "./Keybind";
import { KeybindChecker, type KeyEvent } from "./KeybindChecker";
import { KeybindParser } from "./KeybindParser";
import { KeybindTokenizer } from "./KeybindTokenizer";

type CheckFn = (e: KeyEvent) => boolean;

interface RegisteredKeybind extends Keybind {
  check: CheckFn[];
}

export const [KeybindProvider, , useKeybindContext] = createSolidContext(() => {
  const { config } = useConfig();
  const commandsContext = useCommandsContext();
  const [keybinds, setKeybinds] = createSignal<RegisteredKeybind[]>([]);

  const createChecker = (hotkeyExpression: string) => {
    const tokens = new KeybindTokenizer(hotkeyExpression).tokenize();
    const keyExpression = new KeybindParser(tokens).parseKeyExpression();

    return keyExpression.map(
      (a) => (e: KeyEvent) => new KeybindChecker(e, config.leaderKey).check(a),
    );
  };

  const registerKeybind = (keybind: Keybind) => {
    const registeredKeybind = {
      ...keybind,
      check: createChecker(keybind.keybindExpression),
    };

    setKeybinds((k) => [...k, registeredKeybind]);
  };

  const unregisterKeybind = (keybind: Keybind) => {
    setKeybinds((keys) => {
      return keys.filter(
        (k) => k.keybindExpression !== keybind.keybindExpression,
      );
    });
  };

  onMount(() => {
    const configurationKeybinds = Object.entries(config.keybindings || {});

    for (const [keybindExpression, command] of configurationKeybinds) {
      registerKeybind({ command, keybindExpression });
    }
  });

  onMount(() => {
    let i = 0;

    function checkAndTrigger(e: KeyboardEvent) {
      // We reverse the keybind because we want to potentially trigger them
      // in the reverse order they were registered. If a keybind was registered
      // after another one it should take precedence
      const reverseKeybinds = [...keybinds().values()].reverse();

      const keybindsToCheck = reverseKeybinds.filter(
        (k) => k.check[i] !== undefined,
      );

      if (!keybindsToCheck.length) {
        i = 0;
        return;
      }

      const isInvalidTarget =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement;

      let keybindHit = false;

      for (const bind of keybindsToCheck) {
        // If the target element is an input element we skip triggering
        // the keybind. Unless the keybind specifically override it
        if (isInvalidTarget && !bind.overrideInput) continue;

        // This was checked above
        const checker = bind.check[i] as CheckFn;

        if (checker(e)) {
          keybindHit = true;

          if (bind.check.length === i + 1) {
            e.preventDefault();
            e.stopPropagation();
            commandsContext.triggerCommand(bind.command);
            // Reset checker index if we trigger a binding
            i = 0;
            return;
          }
        }
      }

      // If no keybind was hit during the check we just reset again
      if (!keybindHit) {
        i = 0;
      } else {
        // Increment the checker index when we did not hit any keybinds
        i += 1;
      }
    }

    window.addEventListener("keydown", checkAndTrigger);
    return () => window.removeEventListener("keydown", checkAndTrigger);
  });

  return {
    keybinds,
    registerKeybind,
    unregisterKeybind,
  };
});
