import { useLocalStorage } from "@mantine/hooks";
import Database from "@tauri-apps/plugin-sql";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useAppForm } from "./components/form";
import { createReactContext } from "./createReactContext";

export const [RootConnectionCredentialsProvider, , useConnectionCredentials] =
  createReactContext(({ databaseUrlRaw }: { databaseUrlRaw: string }) => {
    let url = new URL(databaseUrlRaw);
    let database = url.pathname.slice(1) || undefined;

    // Default to postgres database if none is provided
    if (!database) {
      database = "postgres";
      url = new URL(`/${database}`, url);
    }

    return { databaseUrlRaw, database };
  });

export function ConnectionCredentialsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [databaseUrlRaw, setDatabaseUrlRaw] = useLocalStorage({
    key: "databaseUrl",
  });

  const form = useAppForm({
    defaultValues: { databaseUrl: "" },
    validators: {
      onChange: z.object({
        databaseUrl: z.url(),
      }),
    },
    onSubmit: async ({ value }) => {
      try {
        await Database.load(value.databaseUrl);
        setDatabaseUrlRaw(value.databaseUrl);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    },
  });

  if (!databaseUrlRaw) {
    return (
      <div className="h-screen w-screen grid place-items-center">
        <form
          className="flex min-w-sm flex-col gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <form.AppField
            name="databaseUrl"
            children={(field) => (
              <field.TextField
                type="url"
                placeholder="postgres://ai:slop@localhost:1337/vibin"
              />
            )}
          />
          <form.SubmitButton children="Submit" />
        </form>
      </div>
    );
  }

  return (
    <RootConnectionCredentialsProvider databaseUrlRaw={databaseUrlRaw}>
      {children}
    </RootConnectionCredentialsProvider>
  );
}
