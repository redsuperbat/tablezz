import { Toast, toaster } from "@kobalte/core/toast";
import { createSignal } from "solid-js";

export type MessageType = "info" | "success" | "error";

export interface StoredMessage {
  type: MessageType;
  text: string;
  timestamp: Date;
}

const [messageHistory, setMessageHistory] = createSignal<StoredMessage[]>([]);

function addToHistory(type: MessageType, text: string) {
  setMessageHistory((prev) => [...prev, { type, text, timestamp: new Date() }]);
}

function info(text: string) {
  addToHistory("info", text);
  toaster.clear();
  toaster.show((p) => (
    <Toast toastId={p.toastId} class="text-blue-600">
      {text}
    </Toast>
  ));
}

function success(text: string) {
  addToHistory("success", text);
  toaster.clear();
  toaster.show((p) => (
    <Toast toastId={p.toastId} class="text-emerald-600">
      {text}
    </Toast>
  ));
}

function error(text: string) {
  addToHistory("error", text);
  toaster.clear();
  toaster.show((p) => (
    <Toast toastId={p.toastId} class="text-red-600">
      {text}
    </Toast>
  ));
}

function clear() {
  toaster.clear();
}

function getHistory() {
  return messageHistory();
}

function clearHistory() {
  setMessageHistory([]);
}

export function Messages() {
  return (
    <Toast.Region duration={10_000} limit={1}>
      <Toast.List class="font-mono text-sm" />
    </Toast.Region>
  );
}

export const message = {
  info,
  success,
  error,
  clear,
  getHistory,
  clearHistory,
};
