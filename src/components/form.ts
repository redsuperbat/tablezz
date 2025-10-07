import { createFormHook, createFormHookContexts } from "@tanstack/solid-form";
import { SubmitButton } from "./SubmitButton";
import { TextField } from "./TextField";

const { fieldContext, formContext, useFieldContext } = createFormHookContexts();

export { useFieldContext };
export const { useAppForm } = createFormHook({
  fieldComponents: {
    TextField,
  },
  formComponents: {
    SubmitButton,
  },
  fieldContext,
  formContext,
});
