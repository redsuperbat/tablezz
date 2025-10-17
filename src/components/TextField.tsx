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
  autofocus?: boolean;
  autocomplete?: string;
}) {
  const field = useFieldContext<string>();

  return (
    <TextFieldRoot>
      <TextFieldLabel>{props.label}</TextFieldLabel>
      <BaseTextField
        value={field().state.value}
        onInput={(e) => {
          const target = e.target as HTMLInputElement;
          return field().handleChange(target.value);
        }}
        type={props.type}
        placeholder={props.placeholder}
        autocomplete={props.autocomplete}
        autofocus={props.autofocus}
      />
    </TextFieldRoot>
  );
}
