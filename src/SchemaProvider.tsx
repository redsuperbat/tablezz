import { createReactContext } from "./createReactContext";

export const [SchemaProvider, , useSchemaContext] = createReactContext(
  (props: { schemaName: string }) => props,
);
