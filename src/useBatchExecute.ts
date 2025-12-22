import { useDatabase } from "./database/useDatabase";

export function useBatchExecute() {
  const { batchExecute } = useDatabase();

  return { exec: (statements: string[]) => batchExecute(statements) };
}
