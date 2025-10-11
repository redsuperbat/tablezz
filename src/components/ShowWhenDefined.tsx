import { type Accessor, type JSXElement, Show } from "solid-js";

export function ShowWhenDefined<A>(props: {
  when: Accessor<A | undefined | null>;
  children: (v: A) => JSXElement;
}) {
  return <Show when={props.when()}>{props.children(props.when() as A)}</Show>;
}
