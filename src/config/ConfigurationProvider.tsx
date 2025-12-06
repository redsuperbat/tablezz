import { useQuery } from "@tanstack/solid-query";
import { BaseDirectory, watch } from "@tauri-apps/plugin-fs";
import {
  type Accessor,
  createContext,
  Match,
  onMount,
  type ParentProps,
  Switch,
  useContext,
} from "solid-js";
import { message } from "@/commands/Messages";
import { useDisposables } from "@/lib/useDisposables";
import {
  type Configuration,
  configurationFilename,
  initConfiguration,
} from "./ConfigurationService";

interface ConfigurationContext {
  config: Accessor<Configuration>;
}
const ConfigurationContext = createContext<ConfigurationContext | null>(null);

export function ConfigurationProvider(props: ParentProps) {
  const disposables = useDisposables();
  const configQuery = useQuery(() => ({
    queryFn: () => initConfiguration(),
    queryKey: [],
    refetchOnWindowFocus: false,
    retry: false,
  }));

  onMount(() => {
    watch(
      configurationFilename,
      () => {
        configQuery.refetch();
        message.info("Reloaded configuration");
      },
      {
        baseDir: BaseDirectory.Home,
      },
    ).then((w) => disposables.add(w));
  });

  return (
    <Switch>
      <Match when={configQuery.data}>
        {(config) => (
          <ConfigurationContext.Provider value={{ config }}>
            {props.children}
          </ConfigurationContext.Provider>
        )}
      </Match>
      <Match when={!configQuery.data}>Loading...</Match>
    </Switch>
  );
}

export function useConfig() {
  const ctx = useContext(ConfigurationContext);
  if (!ctx) {
    throw new Error("Configuration context not found");
  }
  return ctx;
}
