import { useCallback, useRef } from "react";
import { createReactContext } from "@/createReactContext";
import type { Keybind } from "./useRegisterKeybind";

export const [KeybindProvider, , useKeybindContext] = createReactContext(() => {
  const keybinds = useRef<{ [key: string]: Keybind }>({});
  const register = useCallback((key: Keybind) => {
    keybinds.current[key.name] = key;
  }, []);

  return {
    keybinds() {
      return keybinds.current;
    },
    register,
  };
});
