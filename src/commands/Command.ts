import type { ZodType } from "zod";

type InferParsedSchemas<T extends ZodType[]> = {
  [K in keyof T]: T[K] extends ZodType<infer U> ? U : never;
};

export interface Command<T extends ZodType[] = ZodType<unknown>[]> {
  name: string;
  description?: string;
  actionArgs?: T;
  action: (...args: InferParsedSchemas<T>) => void;
}
