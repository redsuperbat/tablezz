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
        <div
          class="grid place-content-center gap-10"
          style={{ "grid-template-rows": "auto 1fr auto" }}
        >
          <h2 class="mt-10 text-center text-4xl text-black">
            Tablezz internal error occurred
          </h2>
          <pre class="max-h-96 overflow-y-scroll">
            <h4>{err.message}</h4>
            <p>{err.stack}</p>
          </pre>
          <Button
            class="cursor-pointer"
            variant="outline"
            onclick={() => {
              queryClient.resetQueries();
              reset();
            }}
          >
            Reset
          </Button>
        </div>
      )}
    >
      {props.children}
    </SolidErrorBoundary>
  );
}
