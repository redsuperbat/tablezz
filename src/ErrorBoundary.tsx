import { type JSX, ErrorBoundary as SolidErrorBoundary } from "solid-js";

interface ErrorBoundaryProps {
  children: JSX.Element;
  fallback?: (err: Error, reset: () => void) => JSX.Element;
}

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return (
    <SolidErrorBoundary
      fallback={(err, reset) =>
        props.fallback?.(err, reset) ?? (
          <div>
            <h2>Error: {err.message}</h2>
            <button onClick={reset}>Reset</button>
          </div>
        )
      }
    >
      {props.children}
    </SolidErrorBoundary>
  );
}
