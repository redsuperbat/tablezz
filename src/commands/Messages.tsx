import { Toast, toaster } from "@kobalte/core/toast";

function info(message: string) {
  toaster.clear();
  toaster.show((p) => (
    <Toast toastId={p.toastId} class="text-blue-600">
      {message}
    </Toast>
  ));
}

function success(message: string) {
  toaster.clear();
  toaster.show((p) => (
    <Toast toastId={p.toastId} class="text-emerald-600">
      {message}
    </Toast>
  ));
}

function error(message: string) {
  toaster.clear();
  toaster.show((p) => (
    <Toast toastId={p.toastId} class="text-red-600">
      {message}
    </Toast>
  ));
}

function clear() {
  toaster.clear();
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
};
