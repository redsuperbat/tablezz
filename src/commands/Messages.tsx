import { Toast, toaster } from "@kobalte/core/toast";

function Message(props: { message: string; class: string }) {
  clear();
  return toaster.show((p) => (
    <Toast toastId={p.toastId} class={props.class}>
      {props.message}
    </Toast>
  ));
}

function info(message: string) {
  return <Message message={message} class="text-blue-600" />;
}

function success(message: string) {
  return <Message message={message} class="text-emerald-600" />;
}

function error(message: string) {
  return <Message message={message} class="text-red-600" />;
}

function clear() {
  toaster.clear();
}

export function Messages() {
  return (
    <Toast.Region limit={1}>
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
