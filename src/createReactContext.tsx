import React, { createContext, type PropsWithChildren } from "react";

type ContextHook<Props, Value> = (props: Props) => Value;

export function createReactContext<Props, Value>(
	useValue: ContextHook<Props, Value>,
) {
	const Context = createContext<Value | null>(null);

	function Provider(props: PropsWithChildren<Props>) {
		const value = useValue(props);

		return <Context.Provider value={value} {...props} />;
	}

	function useContext() {
		return React.useContext(Context);
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
