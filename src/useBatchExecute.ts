import { invoke } from "@tauri-apps/api/core";
import { useConnectionCredentials } from "./ConnectionCredentialsProvider";

export function useBatchExecute() {
  const { url } = useConnectionCredentials();

  return {
    exec: async (statements: string[]) => {
      return await invoke("batch_execute", { db: url(), statements });
    },
  };
}
