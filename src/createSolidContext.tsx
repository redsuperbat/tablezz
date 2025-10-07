import {
  createContext,
  type ParentProps,
  useContext as useContextSolid,
} from "solid-js";

type ContextHook<Props, Value> = (props: Props) => Value;

export function createSolidContext<
  Props extends Record<string, unknown>,
  Value,
>(useValue: ContextHook<Props, Value>) {
  const Context = createContext<Value | null>(null);

  function Provider(props: ParentProps<Props>) {
    const value = useValue(props);

    return <Context.Provider value={value}>{props.children}</Context.Provider>;
  }

  function useContext() {
    return useContextSolid(Context);
  }

  function useContextOrThrow() {
    const ctx = useContext();
    if (!ctx) {
      throw new Error("No parent context found");
    }
    return ctx;
  }

  return [Provider, useContext, useContextOrThrow] as const;
}
