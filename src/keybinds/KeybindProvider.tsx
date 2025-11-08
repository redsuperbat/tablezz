import { createSignal, onMount } from "solid-js";
import { useCommandsContext } from "@/commands/CommandsContext";
import { useConfig } from "@/config/ConfigurationProvider";
import { createSolidContext } from "@/createSolidContext";
import type { Keybind } from "./Keybind";
import { KeybindChecker, type KeyEvent } from "./KeybindChecker";
import { KeybindFormatter } from "./KeybindFormatter";
import { KeybindParser, type KeyExpression } from "./KeybindParser";
import { KeybindTokenizer } from "./KeybindTokenizer";

type CheckFn = (e: KeyEvent) => boolean;

interface RegisteredKeybind extends Keybind {
  check: CheckFn[];
  ast: KeyExpression;
}

export const [KeybindProvider, , useKeybindContext] = createSolidContext(() => {
  const { config } = useConfig();
  const commandsContext = useCommandsContext();
  const formatter = new KeybindFormatter();
  const [keybinds, setKeybinds] = createSignal<RegisteredKeybind[]>([]);
  const [potentialKeybinds, setPotentialKeybinds] =
    createSignal<{ bind: string; command: string }[]>();

  function showAllPotentialKeybinds() {
    const potentialKeybinds = keybinds().map((k) => ({
      bind: formatter.format(k.ast),
      command: k.command,
    }));

    setPotentialKeybinds(potentialKeybinds);
  }

  function clearPotentialKeybinds() {
    setPotentialKeybinds(undefined);
  }

  const compileKeybind = (keyExpression: string) => {
    const tokens = new KeybindTokenizer(keyExpression).tokenize();
    const ast = new KeybindParser(tokens).parseKeyExpression();

    const checker = ast.map(
      (keybind) => (e: KeyEvent) =>
        new KeybindChecker(e, config.leaderKey).check(keybind),
    );

    return { checker, ast };
  };

  const registerKeybind = (keybind: Keybind) => {
    const compilation = compileKeybind(keybind.keybindExpression);
    const registeredKeybind = {
      ...keybind,
      check: compilation.checker,
      ast: compilation.ast,
    };

    setKeybinds((k) => [...k, registeredKeybind]);
  };

  const unregisterKeybind = (keybind: Keybind) => {
    setKeybinds((keys) => {
      return keys.filter((k) => k.command !== keybind.command);
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
    let potentialKeybinds: RegisteredKeybind[] | undefined;

    function reset() {
      i = 0;
      potentialKeybinds = undefined;
      clearPotentialKeybinds();
    }

    function checkAndTrigger(e: KeyboardEvent) {
      // We reverse the keybind because we want to potentially trigger them
      // in the reverse order they were registered. If a keybind was registered
      // after another one it should take precedence
      if (!potentialKeybinds) {
        potentialKeybinds = [...keybinds()].reverse();
      }

      const reverseKeybinds = potentialKeybinds.slice();

      const keybindsToCheck = reverseKeybinds.filter(
        (k) => k.check[i] !== undefined,
      );

      if (!keybindsToCheck.length) {
        reset();
        return;
      }

      const isInvalidTarget =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement;

      let keybindHit = false;
      const newPotentialKeybinds: RegisteredKeybind[] = [];

      for (const bind of keybindsToCheck) {
        // If the target element is an input element we skip triggering
        // the keybind. Unless the keybind specifically override it
        if (isInvalidTarget && !bind.overrideInput) continue;

        // This was checked above
        const checker = bind.check[i] as CheckFn;

        if (checker(e)) {
          keybindHit = true;
          newPotentialKeybinds.push(bind);

          if (bind.check.length === i + 1) {
            // Clear potential keybinds before triggering command
            reset();

            e.preventDefault();
            e.stopPropagation();

            commandsContext.triggerCommand(bind.command);

            return;
          }
        }
      }

      // If no keybind was hit during the check we just reset again
      if (!keybindHit) {
        reset();
      } else {
        // Increment the checker index when we did not hit any keybinds
        i += 1;

        potentialKeybinds = newPotentialKeybinds;
        // Grab the potential keybinds to show them for the
        // user, we format the ast to grab the keybinds properly
        const potentials = newPotentialKeybinds
          .values()
          .filter((k) => k.check[i] !== undefined)
          .map((k) => ({ node: k.ast[i], command: k.command }))
          .map((n) => ({
            bind: formatter.format(n.node ? [n.node] : []),
            command: n.command,
          }))
          .toArray();

        if (potentials.length > 0) {
          setPotentialKeybinds(potentials);
        }
      }
    }

    window.addEventListener("keydown", checkAndTrigger);
    return () => window.removeEventListener("keydown", checkAndTrigger);
  });

  return {
    keybinds,
    registerKeybind,
    potentialKeybinds,
    unregisterKeybind,
    showAllPotentialKeybinds,
    clearPotentialKeybinds,
  };
});
