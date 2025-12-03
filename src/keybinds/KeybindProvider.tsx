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
  commandDescription: string | undefined;
}

export const [KeybindProvider, , useKeybindContext] = createSolidContext(() => {
  const { config } = useConfig();
  const commandsContext = useCommandsContext();
  const formatter = new KeybindFormatter();
  const [keybinds, setKeybinds] = createSignal<Map<string, RegisteredKeybind>>(
    new Map(),
  );
  const [potentialKeybinds, setPotentialKeybinds] =
    createSignal<
      { bind: string; command: string; description: string | undefined }[]
    >();

  function showAllPotentialKeybinds() {
    const potentialKeybinds = keybinds()
      .values()
      .map((k) => ({
        bind: formatter.format(k.ast),
        command: k.command,
        description: k.commandDescription,
      }))
      .toArray();

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

  const registerKeybind = (
    keybind: Keybind & { commandDescription: string | undefined },
  ) => {
    const compilation = compileKeybind(keybind.keybindExpression);
    setKeybinds((map) =>
      new Map(map).set(keybind.command, {
        ...keybind,
        check: compilation.checker,
        ast: compilation.ast,
        commandDescription: keybind.commandDescription,
      }),
    );
  };

  const unregisterKeybind = (keybind: Keybind) => {
    setKeybinds((map) => {
      const next = new Map(map);
      next.delete(keybind.command);
      return next;
    });
  };

  onMount(() => {
    const configurationKeybinds = Object.entries(config.keybinds || {});

    for (const [keybindExpression, command] of configurationKeybinds) {
      if (typeof command === "string") {
        registerKeybind({
          command,
          keybindExpression,
          commandDescription: undefined,
        });
      } else {
        registerKeybind({
          command: command.command,
          commandDescription: command.description,
          keybindExpression,
        });
      }
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
        potentialKeybinds = keybinds().values().toArray().reverse();
      }

      const reverseKeybinds = potentialKeybinds.slice();

      const keybindsToCheck = reverseKeybinds
        .filter((k) => k.check[i] !== undefined)
        .sort((a, b) => {
          const aNode = a.ast[i];
          const bNode = b.ast[i];
          const countModifiers = (node: KeyExpression[number] | undefined) => {
            if (!node) return 0;
            return node.kind === "combination" ? 1 : 0;
          };
          return countModifiers(bNode) - countModifiers(aNode);
        });

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
          .map((k) => ({
            node: k.ast[i],
            command: k.command,
            commandDescription: k.commandDescription,
          }))
          .map((n) => ({
            bind: formatter.format(n.node ? [n.node] : []),
            command: n.command,
            description: n.commandDescription,
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
