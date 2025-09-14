import { useEffect } from "react";
import { useHotkeyRegister } from "./hotkeys/useHotkeyRegister";

const keybinds: {
	[key: string]: Keybind;
} = {};

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
			| "PrintScreen"
			| "Pause"
			| "ContextMenu"
			| "Help"
	  )
	| (string & {});

interface Keybind {
	name: string;
	defaultTrigger: KeybindExpression;
	onTrigger(e: KeyboardEvent): void;
}

export function useRegisterKeybind(bind: Keybind) {
	const registerHotkey = useHotkeyRegister();
	keybinds[bind.name] = bind;

	useEffect(() => {
		const register = registerHotkey(bind.defaultTrigger, bind.onTrigger);

		return () => register.unsubscribe();
	}, [bind.name]);
}
