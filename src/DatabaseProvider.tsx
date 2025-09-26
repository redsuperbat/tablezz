import { useConnectionCredentials } from "./ConnectionCredentialsProvider";
import { createReactContext } from "./createReactContext";

export const [DatabaseProvider, , useDatabaseContext] = createReactContext(
  () => {
    const { database } = useConnectionCredentials();
    return { database };
  },
);
