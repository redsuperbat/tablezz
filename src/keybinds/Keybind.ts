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
  command: string;
  keybindExpression: KeybindExpression;
  /**
   * Whether the keybind should override the
   * input if the event target originates from a
   * textarea or input element
   * */
  overrideInput?: boolean;
}
