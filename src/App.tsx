import { Toaster } from "@/components/ui/toast";
import { ConnectionCredentialsProvider } from "./ConnectionCredentialsProvider";
import { CommandPalette } from "./commands/CommandPalette";
import { CommandsProvider } from "./commands/CommandsContext";
import { ConfigurationProvider } from "./config/ConfigurationProvider";
import { QueryHistoryProvider } from "./database/QueryHistoryProvider";
import { DatabaseConnectionProvider } from "./database/useDatabase";
import { ErrorBoundary } from "./ErrorBoundary";
import { Finder } from "./Finder";
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
          <DatabaseConnectionProvider>
            <ConfigurationProvider>
              <CommandsProvider>
                <KeybindProvider>
                  <CommandPalette />
                  <QueryHistoryProvider>
                    <RouteProvider>
                      <SchemaProvider>
                        <SelectedTableProvider>
                          <KeybindHelp />
                          <Finder />
                          <Router />
                        </SelectedTableProvider>
                      </SchemaProvider>
                    </RouteProvider>
                  </QueryHistoryProvider>
                </KeybindProvider>
              </CommandsProvider>
            </ConfigurationProvider>
          </DatabaseConnectionProvider>
        </ConnectionCredentialsProvider>
      </ErrorBoundary>
      <Toaster />
    </SuspenseBoundary>
  );
}
