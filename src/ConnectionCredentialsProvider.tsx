import { makePersisted } from "@solid-primitives/storage";
import Database from "@tauri-apps/plugin-sql";
import { createSignal, Match, type ParentProps, Switch } from "solid-js";
import { z } from "zod";
import { useRegisterCommand } from "./commands/useRegisterCommand";
import { useAppForm } from "./components/form";
import { toast } from "./components/ui/toast";
import { createSolidContext } from "./createSolidContext";

export const [RootConnectionCredentialsProvider, , useConnectionCredentials] =
  createSolidContext(({ databaseUrlRaw }: { databaseUrlRaw: string }) => {
    let url = new URL(databaseUrlRaw);
    let database = url.pathname.slice(1) || undefined;

    // Default to postgres database if none is provided
    if (!database) {
      database = "postgres";
      url = new URL(`/${database}`, url);
    }

    return { databaseUrlRaw, database };
  });

export function ConnectionCredentialsProvider(props: ParentProps) {
  const [databaseUrlRaw, setDatabaseUrlRaw] = makePersisted(
    createSignal<string>(),
    { name: "databaseurl" },
  );

  useRegisterCommand({
    name: "ClearDatabaseUrl",
    action() {
      setDatabaseUrlRaw(undefined);
    },
  });

  const form = useAppForm(() => ({
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
  }));

  return (
    <Switch>
      <Match when={databaseUrlRaw()}>
        {(url) => (
          <RootConnectionCredentialsProvider databaseUrlRaw={url()}>
            {props.children}
          </RootConnectionCredentialsProvider>
        )}
      </Match>
      <Match when={!databaseUrlRaw()}>
        <div class="grid h-screen w-screen place-items-center">
          <form
            class="flex min-w-sm flex-col gap-1"
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
                  autofocus
                  autocomplete="url"
                  placeholder="postgres://ai:slop@localhost:1337/vibin"
                />
              )}
            />
            <form.SubmitButton children="Submit" />
          </form>
        </div>
      </Match>
    </Switch>
  );
}
