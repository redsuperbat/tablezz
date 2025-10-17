import { makePersisted } from "@solid-primitives/storage";
import {
  type Accessor,
  createSignal,
  Match,
  type ParentProps,
  Switch,
} from "solid-js";
import { z } from "zod";
import { useRegisterCommand } from "./commands/useRegisterCommand";
import { createSolidContext } from "./createSolidContext";

export const [RootConnectionCredentialsProvider, , useConnectionCredentials] =
  createSolidContext(
    ({ databaseUrlRaw }: { databaseUrlRaw: Accessor<string> }) => {
      const credentials = () => {
        let url = new URL(databaseUrlRaw());
        let database = url.pathname.slice(1) || undefined;

        // Default to postgres database if none is provided
        if (!database) {
          database = "postgres";
          url = new URL(`/${database}`, url);
        }

        return { url: url.toString(), database };
      };

      return {
        url: () => credentials().url,
        database: () => credentials().database,
      };
    },
  );

export function ConnectionCredentialsProvider(props: ParentProps) {
  const [databaseUrlRaw, setDatabaseUrlRaw] = makePersisted(
    createSignal<string>(),
    { name: "databaseurl" },
  );

  useRegisterCommand({
    name: "DatabaseUrlAdd",
    actionArgs: [z.url()],
    action(url) {
      setDatabaseUrlRaw(url);
    },
  });

  useRegisterCommand({
    name: "DatabaseUrlClear",
    action() {
      setDatabaseUrlRaw(undefined);
    },
  });

  return (
    <Switch>
      <Match when={databaseUrlRaw()}>
        {(url) => (
          <RootConnectionCredentialsProvider databaseUrlRaw={url}>
            {props.children}
          </RootConnectionCredentialsProvider>
        )}
      </Match>
      <Match when={!databaseUrlRaw()}>
        <div class="grid h-screen w-screen place-items-center">
          <pre>
            <code>Press ":" then type DatabaseUrlAdd &lt;url&gt;</code>
          </pre>
        </div>
      </Match>
    </Switch>
  );
}
