import { createSignal } from "solid-js";
import { createSolidContext } from "./createSolidContext";

export const [SchemaProvider, , useSchemaContext] = createSolidContext(() => {
  const [schema, setSchema] = createSignal("public");

  return { schema, setSchema };
});
