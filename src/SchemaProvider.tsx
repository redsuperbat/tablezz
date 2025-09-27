import { useState } from "react";
import { createReactContext } from "./createReactContext";

export const [SchemaProvider, , useSchemaContext] = createReactContext(() => {
  const [schema, setSchema] = useState("public");

  return { schema, setSchema };
});
