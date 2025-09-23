import { useEffect } from "react";
import { useConfig } from "@/config/ConfigurationProvider";
import { useKeybindChecker } from "@/keybinds/useKeybindChecker";
import { useKeybindContext } from "./KeybindProvider";

export type KeybindExpression =
  // Whitespace & Editing
  | (
      | "Enter"
      | "Tab"
      | "Backspace"
      | "Delete"
      | "Insert"

      // Navigation
      | "ArrowUp"
      | "ArrowDown"
      | "ArrowLeft"
      | "ArrowRight"
      | "Home"
      | "End"
      | "PageUp"
      | "PageDown"

      // Modifiers
      | "Shift"
      | "Control"
      | "Alt"
      | "Meta"
      | "AltGraph"

      // Function keys
      | "F1"
      | "F2"
      | "F3"
      | "F4"
      | "F5"
      | "F6"
      | "F7"
      | "F8"
      | "F9"
      | "F10"
      | "F11"
      | "F12"
      | "F13"
      | "F14"
      | "F15"
      | "F16"
      | "F17"
      | "F18"
      | "F19"
      | "F20"
      | "F21"
      | "F22"
      | "F23"
      | "F24"

      // Multimedia & System control
      | "AudioVolumeUp"
      | "AudioVolumeDown"
      | "AudioVolumeMute"
      | "MediaPlayPause"
      | "MediaStop"
      | "MediaTrackNext"
      | "MediaTrackPrevious"
      | "LaunchApplication1"
      | "LaunchApplication2"
      | "LaunchMail"
      | "BrowserBack"
      | "BrowserForward"
      | "BrowserRefresh"
      | "BrowserStop"
      | "BrowserSearch"
      | "BrowserFavorites"
      | "BrowserHome"

      // Lock keys
      | "CapsLock"
      | "NumLock"
      | "ScrollLock"

      // IME & Composition
      | "Dead"
      | "Compose"
      | "Process"
      | "Convert"
      | "NonConvert"
      | "KanaMode"
      | "KanjiMode"
      | "Hiragana"
      | "Katakana"
      | "HangulMode"
      | "HanjaMode"

      // Miscellaneous
      | "Escape"
      | "Space"
      | "PrintScreen"
      | "Pause"
      | "ContextMenu"
      | "Help"
    )
  | (string & {});

export interface Keybind {
  name: string;
  keybindExpression: KeybindExpression;
  onTrigger(e: KeyboardEvent): void;
}

export function useRegisterKeybind(bind: Keybind) {
  const config = useConfig();
  const keybindContext = useKeybindContext();

  bind.keybindExpression =
    config.get("keybindings")[bind.name] ?? bind.keybindExpression;

  const check = useKeybindChecker(bind.keybindExpression);

  keybindContext.register(bind);

  useEffect(() => {
    function checkAndExecute(e: KeyboardEvent) {
      if (!check(e)) return;
      bind.onTrigger(e);
    }

    window.addEventListener("keyup", checkAndExecute);
    return () => window.removeEventListener("keyup", checkAndExecute);
  }, [bind.name, bind.onTrigger, check]);
}
