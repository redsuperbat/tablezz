import {
  type HTMLInputAutoCompleteAttribute,
  type HTMLInputTypeAttribute,
  useId,
} from "react";
import { useFieldContext } from "./form";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function TextField({
  label,
  autoComplete,
  type,
  placeholder,
}: {
  label?: string;
  autoComplete?: HTMLInputAutoCompleteAttribute;
  type?: HTMLInputTypeAttribute;
  placeholder?: string;
}) {
  const labelId = useId();
  const field = useFieldContext<string>();

  return (
    <>
      <Label htmlFor={labelId}>{label}</Label>
      <Input
        value={field.state.value}
        onChange={(e) => field.setValue(e.target.value)}
        id={labelId}
        placeholder={placeholder}
        autoComplete={autoComplete}
        type={type}
      />
    </>
  );
}
