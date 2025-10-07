import { type JSX, ErrorBoundary as SolidErrorBoundary } from "solid-js";
import { Button } from "./components/ui/button";

interface ErrorBoundaryProps {
  children: JSX.Element;
  fallback?: (err: Error, reset: () => void) => JSX.Element;
}

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return (
    <SolidErrorBoundary
      fallback={(err: Error, reset) =>
        props.fallback?.(err, reset) ?? (
          <div>
            <h2>Error: {err.message}</h2>
            <pre>{err.stack}</pre>
            <Button onClick={reset}>Reset</Button>
          </div>
        )
      }
    >
      {props.children}
    </SolidErrorBoundary>
  );
}
