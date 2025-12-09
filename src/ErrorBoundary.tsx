import { useQueryClient } from "@tanstack/solid-query";
import { type JSX, ErrorBoundary as SolidErrorBoundary } from "solid-js";
import { Button } from "./components/ui/button";

interface ErrorBoundaryProps {
  children: JSX.Element;
  fallback?: (err: Error, reset: () => void) => JSX.Element;
}

export function ErrorBoundary(props: ErrorBoundaryProps) {
  const queryClient = useQueryClient();

  return (
    <SolidErrorBoundary
      fallback={(err: Error, reset) =>
        props.fallback?.(err, reset) ?? (
          <div class="grid h-screen w-screen place-content-center">
            <h2>Tablezz internal error occurred</h2>
            <Button onclick={() => queryClient.resetQueries()}>Reset</Button>
          </div>
        )
      }
    >
      {props.children}
    </SolidErrorBoundary>
  );
}
