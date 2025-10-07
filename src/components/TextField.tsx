import { useFieldContext } from "./form";
import {
  TextField as BaseTextField,
  TextFieldLabel,
  TextFieldRoot,
} from "./ui/textfield";

export function TextField(props: {
  type: string;
  label?: string;
  placeholder?: string;
}) {
  const field = useFieldContext<string>();

  return (
    <TextFieldRoot>
      <TextFieldLabel>{props.label}</TextFieldLabel>
      <BaseTextField
        value={field().state.value}
        onChange={(e) => field().handleChange(e.target.value)}
        type={props.type}
        placeholder={props.placeholder}
      />
    </TextFieldRoot>
  );
}
