import type { ParentProps } from "solid-js";
import { Button } from "./ui/button";

export function SubmitButton(props: ParentProps) {
  return <Button type="submit">{props.children}</Button>;
}
