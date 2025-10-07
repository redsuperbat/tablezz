import type { ParentProps } from "solid-js";
import { Button } from "./ui/button";

export function SubmitButton({ children }: ParentProps) {
  return <Button type="submit">{children}</Button>;
}
