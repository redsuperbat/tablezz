import { useSuspenseQuery } from "@tanstack/solid-query";
import { BaseDirectory, watch } from "@tauri-apps/plugin-fs";
import { useEffect } from "react";
import { createSolidContext } from "@/createReactContext";
import { ConfigurationService } from "./ConfigurationService";

export const [ConfigurationProvider, , useConfig] = createSolidContext(() => {
  const query = useSuspenseQuery({
    queryFn: () => ConfigurationService.init(),
    queryKey: [],
    refetchOnWindowFocus: false,
    retry: false,
  });

  useEffect(() => {
    watch(ConfigurationService.filename, () => query.refetch(), {
      baseDir: BaseDirectory.Home,
    });
  }, [query.refetch]);

  return query.data;
});
