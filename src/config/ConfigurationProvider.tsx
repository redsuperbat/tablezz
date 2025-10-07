import { useQuery } from "@tanstack/solid-query";
import { BaseDirectory, watch } from "@tauri-apps/plugin-fs";
import {
  createContext,
  Match,
  onMount,
  type ParentProps,
  Switch,
  useContext,
} from "solid-js";
import {
  type Configuration,
  configurationFilename,
  initConfiguration,
} from "./ConfigurationService";

interface ConfigurationContext {
  config: Configuration;
}
const ConfigurationContext = createContext<ConfigurationContext | null>(null);

export function ConfigurationProvider(props: ParentProps) {
  const configQuery = useQuery(() => ({
    queryFn: () => initConfiguration(),
    queryKey: [],
    refetchOnWindowFocus: false,
    retry: false,
  }));

  onMount(() => {
    watch(configurationFilename, () => configQuery.refetch(), {
      baseDir: BaseDirectory.Home,
    });
  });

  return (
    <Switch>
      <Match when={configQuery.data}>
        <ConfigurationContext.Provider
          value={{ config: configQuery.data as Configuration }}
        >
          {props.children}
        </ConfigurationContext.Provider>
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
