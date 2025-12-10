import { createSignal, getOwner, onMount, runWithOwner } from "solid-js";
import { useCommandsContext } from "@/commands/CommandsContext";
import { createWatcher } from "@/commands/createWatcher";
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

type KeybindMap = Map<string, RegisteredKeybind>;

export type PotentialKeybind = {
  bind: string;
  command: string;
  description: string | undefined;
};

export const [KeybindProvider, , useKeybindContext] = createSolidContext(() => {
  const { config } = useConfig();
  const commandsContext = useCommandsContext();
  const formatter = new KeybindFormatter();

  const [configKeybinds, setConfigKeybinds] = createSignal<KeybindMap>(
    new Map(),
  );
  const [componentKeybinds, setComponentKeybinds] = createSignal<KeybindMap>(
    new Map(),
  );

  const [potentialKeybinds, setPotentialKeybinds] =
    createSignal<PotentialKeybind[]>();

  function allKeybinds() {
    const componentMap = componentKeybinds();
    const configMap = configKeybinds();

    const merged = new Map(componentMap);
    for (const [key, keybind] of configMap) {
      merged.set(key, keybind);
    }

    return merged
      .values()
      .map((k) => ({
        bind: formatter.format(k.ast),
        command: k.command,
        description: k.commandDescription,
      }))
      .toArray();
  }

  function showAllPotentialKeybinds() {
    const all = allKeybinds();

    setPotentialKeybinds(all);
  }

  function clearPotentialKeybinds() {
    setPotentialKeybinds(undefined);
  }

  const compileKeybind = (keyExpression: string) => {
    const tokens = new KeybindTokenizer(keyExpression).tokenize();
    const ast = new KeybindParser(tokens).parseKeyExpression();

    const checker = ast.map(
      (keybind) => (e: KeyEvent) =>
        new KeybindChecker(e, config().leaderKey).check(keybind),
    );

    return { checker, ast };
  };

  const normalizeKeybindKey = (keyExpression: string): string => {
    return keyExpression.trim();
  };

  const registerKeybind = (
    keybind: Keybind & { commandDescription: string | undefined },
  ) => {
    const compilation = compileKeybind(keybind.keybindExpression);
    const key = normalizeKeybindKey(keybind.keybindExpression);

    setComponentKeybinds((map) =>
      new Map(map).set(key, {
        ...keybind,
        check: compilation.checker,
        ast: compilation.ast,
        commandDescription: keybind.commandDescription,
      }),
    );
  };

  const unregisterKeybind = (keybind: Keybind) => {
    const key = normalizeKeybindKey(keybind.keybindExpression);
    setComponentKeybinds((map) => {
      const next = new Map(map);
      next.delete(key);
      return next;
    });
  };

  const registerConfigKeybind = (
    keybind: Keybind & { commandDescription: string | undefined },
  ) => {
    const { ast, checker } = compileKeybind(keybind.keybindExpression);
    const key = normalizeKeybindKey(keybind.keybindExpression);

    setConfigKeybinds((map) =>
      new Map(map).set(key, {
        ...keybind,
        check: checker,
        ast,
        commandDescription: keybind.commandDescription,
      }),
    );
  };

  const unregisterConfigKeybind = (keybind: Keybind) => {
    const key = normalizeKeybindKey(keybind.keybindExpression);
    setConfigKeybinds((map) => {
      const next = new Map(map);
      next.delete(key);
      return next;
    });
  };

  createWatcher(config, ({ next, prev }) => {
    // If we have a previous value, we want to clear all the old keybinds before registering a new keybind
    if (prev) {
      const configurationKeybinds = Object.entries(prev.keybinds);
      for (const [keybindExpression, command] of configurationKeybinds) {
        unregisterConfigKeybind({
          command: command.command,
          keybindExpression,
        });
      }
    }

    const configurationKeybinds = Object.entries(next.keybinds);
    for (const [keybindExpression, command] of configurationKeybinds) {
      registerConfigKeybind({
        command: command.command,
        commandDescription: command.description,
        keybindExpression,
      });
    }
  });

  onMount(() => {
    const owner = getOwner();
    let i = 0;
    let potentialKeybinds: RegisteredKeybind[] | undefined;

    function reset() {
      i = 0;
      potentialKeybinds = undefined;
      clearPotentialKeybinds();
    }

    function checkAndTrigger(e: KeyboardEvent) {
      // Build the list of keybinds to check, with config keybinds first
      if (!potentialKeybinds) {
        const configList = configKeybinds().values().toArray();
        const componentList = componentKeybinds().values().toArray();

        // We still reverse each list so recently registered take precedence within their category
        potentialKeybinds = [
          ...configList.reverse(),
          ...componentList.reverse(),
        ];
      }

      const keybindsToCheck = potentialKeybinds
        .filter((k) => k.check[i] !== undefined)
        .sort((a, b) => {
          const aNode = a.ast[i]?.kind === "combination" ? 1 : 0;
          const bNode = b.ast[i]?.kind === "combination" ? 1 : 0;
          return bNode - aNode;
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

            // Run command within the reactive owner context to ensure
            // any computations created during the update have a proper owner
            runWithOwner(owner, () => {
              commandsContext.triggerCommand(bind.command);
            });

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
    registerKeybind,
    potentialKeybinds,
    allKeybinds,
    unregisterKeybind,
    showAllPotentialKeybinds,
  };
});
