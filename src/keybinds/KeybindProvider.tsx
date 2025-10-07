import { createEffect, createMemo, onMount } from "solid-js";
import { useCommandsContext } from "@/commands/CommandsContext";
import { useConfig } from "@/config/ConfigurationProvider";
import { createSolidContext } from "@/createSolidContext";
import type { Keybind } from "./Keybind";
import { KeybindChecker, type KeyEvent } from "./KeybindChecker";
import { KeybindLeaderTracker } from "./KeybindLeaderTracker";
import { KeybindParser } from "./KeybindParser";
import { KeybindTokenizer } from "./KeybindTokenizer";

interface RegisteredKeybind extends Keybind {
  check: (e: KeyEvent) => boolean;
}

class KeybindCollection {
  #keybinds: RegisteredKeybind[] = [];

  register(keybind: RegisteredKeybind) {
    this.delete(keybind);
    this.#keybinds.push(keybind);
  }

  delete(keybind: Keybind) {
    const key = keybind.command + keybind.keybindExpression;
    this.#keybinds = this.#keybinds.filter((k) => {
      const innerKey = k.command + k.keybindExpression;
      return key !== innerKey;
    });
  }

  values() {
    return this.#keybinds.values();
  }
}

export const [KeybindProvider, , useKeybindContext] = createSolidContext(() => {
  const config = useConfig();
  const commandsContext = useCommandsContext();
  const keybinds = new KeybindCollection();

  const leaderTracker = createMemo(
    () =>
      new KeybindLeaderTracker(
        config.get("leaderKeyTimeoutMs"),
        config.get("leaderKey"),
      ),
  );

  const createChecker = (hotkeyExpression: string) => {
    const tokens = new KeybindTokenizer(hotkeyExpression).tokenize();
    const ast = new KeybindParser(tokens).parseKeyExpression();

    return (e: KeyEvent) => new KeybindChecker(e, leaderTracker()).check(ast);
  };

  const registerKeybind = (keybind: Keybind) =>
    keybinds.register({
      ...keybind,
      check: createChecker(keybind.keybindExpression),
    });

  const unregisterKeybind = (key: Keybind) => keybinds.delete(key);

  onMount(() => {
    const configurationKeybinds = Object.entries(config.get("keybindings"));

    for (const [keybindExpression, command] of configurationKeybinds) {
      registerKeybind({ command, keybindExpression });
    }
  });

  createEffect(() => {
    function checkAndTrigger(e: KeyboardEvent) {
      const { trackingStarted } =
        leaderTracker().checkLeaderAndStartTracking(e);

      // If we started tracking the leader key we
      // do not want to check keybinds for the next event
      if (trackingStarted) {
        return;
      }

      const isInvalidTarget =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement;

      // We reverse the keybind because we want to potentially trigger them
      // in the reverse order they were registered. If a keybind was registered
      // after another one it should take precedence
      const reverseKeybinds = [...keybinds.values()].reverse();

      for (const bind of reverseKeybinds) {
        if (!bind.check(e)) continue;

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
  });

  return {
    keybinds: () => keybinds.values().toArray(),
    leaderTracker,
    registerKeybind,
    unregisterKeybind,
  };
});
