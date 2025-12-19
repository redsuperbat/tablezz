import { batch, createSignal } from "solid-js";
import { createSolidContext } from "./createSolidContext";
import { useHopContext } from "./HopContext";

export const [SchemaProvider, , useSchemaContext] = createSolidContext(() => {
  const hopsContext = useHopContext();
  const [schema, setSchema] = createSignal("public");

  function setSchemaAndClearHops(schema: string) {
    batch(() => {
      hopsContext.clear();
      setSchema(schema);
    });
  }

  return { schema, setSchema: setSchemaAndClearHops };
});
