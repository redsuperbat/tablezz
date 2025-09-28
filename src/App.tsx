import { Toaster } from "@/components/ui/sonner";
import { CommandPalette } from "./CommandPalette";
import { ConnectionCredentialsProvider } from "./ConnectionCredentialsProvider";
import { ConfigurationProvider } from "./config/ConfigurationProvider";
import { QueryHistoryProvider } from "./database/QueryHistoryProvider";
import { ErrorBoundary } from "./ErrorBoundary";
import { KeybindHelp } from "./keybinds/KeybindHelp";
import { KeybindProvider } from "./keybinds/KeybindProvider";
import { RouteProvider, Router } from "./Router";
import { SchemaProvider } from "./SchemaProvider";
import { SelectedTableProvider } from "./SelectedTableProvider";
import { SuspenseBoundary } from "./SuspenseBoundary";

export function App() {
  return (
    <SuspenseBoundary>
      <ErrorBoundary>
        <ConnectionCredentialsProvider>
          <ConfigurationProvider>
            <KeybindProvider>
              <QueryHistoryProvider>
                <RouteProvider>
                  <SchemaProvider>
                    <SelectedTableProvider>
                      <KeybindHelp />
                      <CommandPalette />
                      <Router />
                    </SelectedTableProvider>
                  </SchemaProvider>
                </RouteProvider>
              </QueryHistoryProvider>
            </KeybindProvider>
          </ConfigurationProvider>
        </ConnectionCredentialsProvider>
      </ErrorBoundary>
      <Toaster />
    </SuspenseBoundary>
  );
}
