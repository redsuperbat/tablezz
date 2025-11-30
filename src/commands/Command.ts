import type { ZodType } from "zod";

export type InferParsedSchemas<T extends ZodType[]> = {
  [K in keyof T]: T[K] extends ZodType<infer U> ? U : never;
};

export interface Command<T extends ZodType[] = ZodType<unknown>[]> {
  command: string;
  description?: string;
  actionArgs?: T;
  action(...args: InferParsedSchemas<T>): Promise<unknown> | unknown;
}
