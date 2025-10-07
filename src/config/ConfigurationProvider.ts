import { useQuery } from "@tanstack/solid-query";
import { BaseDirectory, watch } from "@tauri-apps/plugin-fs";
import { onMount } from "solid-js";
import { createSolidContext } from "@/createSolidContext";
import { ConfigurationService } from "./ConfigurationService";

export const [ConfigurationProvider, , useConfig] = createSolidContext(() => {
  const query = useQuery(() => ({
    queryFn: () => ConfigurationService.init(),
    queryKey: [],
    refetchOnWindowFocus: false,
    retry: false,
  }));

  onMount(() => {
    watch(ConfigurationService.filename, () => query.refetch(), {
      baseDir: BaseDirectory.Home,
    });
  });

  return query.data;
});
