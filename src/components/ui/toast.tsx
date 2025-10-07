// toast.tsx
import { Toast, toaster } from "@kobalte/core/toast";
import type { JSX } from "solid-js/jsx-runtime";
import { Match, Switch } from "solid-js/web";

function show(message: string) {
  return toaster.show((props) => (
    <Toast toastId={props.toastId} class="toast">
      {message}
    </Toast>
  ));
}

function success(message: string) {
  return toaster.show((props) => (
    <Toast toastId={props.toastId} class="toast toast--success">
      {message}
    </Toast>
  ));
}

function error(message: string) {
  return toaster.show((props) => (
    <Toast toastId={props.toastId} class="toast toast--error">
      {message}
    </Toast>
  ));
}

function promise<T, U>(
  promise: Promise<T> | (() => Promise<T>),
  options: {
    loading?: JSX.Element;
    success?: (data: T) => JSX.Element;
    error?: (error: U) => JSX.Element;
  },
) {
  return toaster.promise(promise, (props) => (
    <Toast
      toastId={props.toastId}
      classList={{
        toast: true,
        "toast-loading": props.state === "pending",
        "toast-success": props.state === "fulfilled",
        "toast-error": props.state === "rejected",
      }}
    >
      <Switch>
        <Match when={props.state === "pending"}>{options.loading}</Match>
        <Match when={props.state === "fulfilled"}>
          {options.success?.(props.data as T)}
        </Match>
        <Match when={props.state === "rejected"}>
          {options.error?.(props.error)}
        </Match>
      </Switch>
    </Toast>
  ));
}

function custom(jsx: () => JSX.Element) {
  return toaster.show((props) => (
    <Toast toastId={props.toastId}>{jsx()}</Toast>
  ));
}

function dismiss(id: number) {
  return toaster.dismiss(id);
}

export function Toaster() {
  return (
    <Toast.Region>
      <Toast.List />
    </Toast.Region>
  );
}

export const toast = {
  show,
  success,
  error,
  promise,
  custom,
  dismiss,
};
