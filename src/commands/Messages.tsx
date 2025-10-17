import { Toast, toaster } from "@kobalte/core/toast";

function Message(props: { message: string; class: string }) {
  return toaster.show((p) => (
    <Toast toastId={p.toastId} class={props.class}>
      {props.message}
    </Toast>
  ));
}

function info(message: string) {
  return <Message message={message} class="text-blue-400" />;
}

function success(message: string) {
  return <Message message={message} class="text-green-400" />;
}

function error(message: string) {
  return <Message message={message} class="text-red-400" />;
}

function clear() {
  toaster.clear();
}

export function Messages() {
  return (
    <Toast.Region limit={1}>
      <Toast.List class="bg-white" />
    </Toast.Region>
  );
}

export const message = {
  info,
  success,
  error,
  clear,
};
