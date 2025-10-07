import { useState } from "react";
import { createSolidContext } from "./createReactContext";

export const [SchemaProvider, , useSchemaContext] = createSolidContext(() => {
  const [schema, setSchema] = useState("public");

  return { schema, setSchema };
});
