import { useSuspenseQuery } from "@tanstack/react-query";
import { BaseDirectory, watch } from "@tauri-apps/plugin-fs";
import { useEffect } from "react";
import { createReactContext } from "@/createReactContext";
import { ConfigurationService } from "./ConfigurationService";

export const [ConfigurationProvider, , useConfig] = createReactContext(() => {
  const query = useSuspenseQuery({
    queryFn: () => ConfigurationService.init(),
    queryKey: [],
    refetchOnWindowFocus: false,
    retry: false,
  });

  useEffect(() => {
    watch(
      ConfigurationService.filename,
      () => {
        return query.refetch();
      },
      {
        baseDir: BaseDirectory.Home,
      },
    );
  }, []);

  return query.data;
});
