import { createSignal, onMount } from "solid-js";
import { useCommandsContext } from "@/commands/CommandsContext";
import { useConfig } from "@/config/ConfigurationProvider";
import { createSolidContext } from "@/createSolidContext";
import type { Keybind } from "./Keybind";
import { KeybindChecker, type KeyEvent } from "./KeybindChecker";
import { KeybindParser } from "./KeybindParser";
import { KeybindTokenizer } from "./KeybindTokenizer";

interface RegisteredKeybind extends Keybind {
  check: ((e: KeyEvent) => boolean)[];
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

      const noKeybindFound = reverseKeybinds.every(
        (k) => k.check[i] === undefined,
      );

      if (noKeybindFound) {
        i = 0;
      }

      const isInvalidTarget =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement;

      for (const bind of reverseKeybinds) {
        // If the target element is an input element we skip triggering
        // the keybind. Unless the keybind specifically override it
        if (isInvalidTarget && !bind.overrideInput) continue;

        const checker = bind.check[i];

        if (!checker) {
          continue;
        }

        if (!checker(e)) {
          continue;
        }

        e.preventDefault();
        e.stopPropagation();
        commandsContext.triggerCommand(bind.command);
        // Reset checker index if we trigger a binding
        i = 0;

        // Only trigger a single binding.
        // We cannot map a single keybind to trigger multiple things
        break;
      }

      // Increment the checker index when we did not hit any keybinds
      i += 1;
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
