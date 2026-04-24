import { makePersisted } from "@solid-primitives/storage";
import { useQueryClient } from "@tanstack/solid-query";
import {
  type Accessor,
  createSignal,
  Match,
  type ParentProps,
  Switch,
} from "solid-js";
import { z } from "zod";
import { useRegisterCommandOnMount } from "./commands/useRegisterCommand";
import { createSolidContext } from "./createSolidContext";
import { useHopContext } from "./HopContext";

export const [RootConnectionCredentialsProvider, , useConnectionCredentials] =
  createSolidContext(
    ({
      databaseUrlRaw,
      savedUrls,
      setActiveUrl,
    }: {
      databaseUrlRaw: Accessor<string>;
      savedUrls: Accessor<string[]>;
      setActiveUrl: (url: string) => void;
    }) => {
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
        savedUrls,
        setActiveUrl,
      };
    },
  );

export function ConnectionCredentialsProvider(props: ParentProps) {
  const hopsContext = useHopContext();
  const queryClient = useQueryClient();
  const [databaseUrlRaw, setDatabaseUrlRaw] = makePersisted(
    createSignal<string>(),
    { name: "databaseurl" },
  );

  const [savedUrls, setSavedUrls] = makePersisted(createSignal<string[]>([]), {
    name: "savedDatabaseUrls",
  });

  const setActiveUrl = (url: string) => {
    hopsContext.clear();
    localStorage.removeItem("selectedTable");
    queryClient.removeQueries();
    setDatabaseUrlRaw(url);
    const urls = savedUrls();
    if (!urls.includes(url)) {
      setSavedUrls([...urls, url]);
    }
  };

  useRegisterCommandOnMount({
    command: "DatabaseUrlAdd",
    description: "Set the database connection URL and save it.",
    actionArgs: [z.url().meta({ title: "<url>" })],
    action(url) {
      setActiveUrl(url);
    },
  });

  useRegisterCommandOnMount({
    command: "DatabaseUrlClear",
    description: "Clear the current database connection URL.",
    action() {
      setDatabaseUrlRaw(undefined);
    },
  });

  useRegisterCommandOnMount({
    command: "DatabaseUrlRemove",
    description: "Remove a saved database URL from the list.",
    actionArgs: [z.url().meta({ title: "<url>" })],
    action(url) {
      const urls = savedUrls();
      setSavedUrls(urls.filter((u) => u !== url));
      // If we're removing the active URL, clear it
      if (databaseUrlRaw() === url) {
        setDatabaseUrlRaw(undefined);
      }
    },
  });

  return (
    <Switch>
      <Match when={databaseUrlRaw()}>
        {(url) => (
          <RootConnectionCredentialsProvider
            databaseUrlRaw={url}
            savedUrls={savedUrls}
            setActiveUrl={setActiveUrl}
          >
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
