import type { ZodType } from "zod";

// Helper type to infer types from an array of ZodType schemas
type InferSchemas<T extends ZodType[]> = {
  [K in keyof T]: T[K] extends ZodType<infer U> ? U : never;
};

export interface Command<T extends ZodType[] = ZodType<unknown>[]> {
  name: string;
  description?: string;
  actionArgs?: T;
  action: (...args: InferSchemas<T>) => void;
}
