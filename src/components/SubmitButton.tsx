import type { ReactNode } from "react";
import { Button } from "./ui/button";

export function SubmitButton({ children }: { children: ReactNode }) {
  return <Button type="submit">{children}</Button>;
}
