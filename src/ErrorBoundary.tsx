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
      fallback={(err: Error, reset) => (
        <div class="grid h-screen w-screen place-content-center">
          <div>
            <h2>Tablezz internal error occurred</h2>
          </div>
          <pre class="max-h-96 overflow-y-scroll">
            {err.message}
            {err.stack}
          </pre>
          <div>
            <Button
              class="cursor-pointer"
              onclick={() => {
                queryClient.resetQueries();
                reset();
              }}
            >
              Reset
            </Button>
          </div>
        </div>
      )}
    >
      {props.children}
    </SolidErrorBoundary>
  );
}
