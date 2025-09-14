import { useEffect } from "react";

const keybinds: {
	[key: string]: Keybind;
} = {};

export type NonPrintableKey =
	// Whitespace & Editing
	(
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
	) & {};

interface Keybind {
	name: string;
	defaultTrigger: ((e: KeyboardEvent) => boolean) | NonPrintableKey;
	onTrigger(e: KeyboardEvent): void;
}

export function useRegisterKeybind(bind: Keybind) {
	keybinds[bind.name] = bind;

	useEffect(() => {
		function onKeyPress(e: KeyboardEvent) {
			const trigger = keybinds[bind.name].defaultTrigger;
			if (typeof trigger === "string" && trigger !== e.key) {
				return;
			}
			if (typeof trigger === "function" && !trigger(e)) {
				return;
			}
			keybinds[bind.name].onTrigger(e);
		}

		window.addEventListener("keyup", onKeyPress);
		return () => window.removeEventListener("keyup", onKeyPress);
	}, [bind.name]);
}
