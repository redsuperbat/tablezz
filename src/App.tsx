import { Toaster } from "@/components/ui/sonner";
import { CommandPalette } from "./CommandPalette";
import { ConnectionCredentialsProvider } from "./ConnectionCredentialsProvider";
import { ConfigurationProvider } from "./config/ConfigurationProvider";
import { DatabaseProvider } from "./DatabaseProvider";
import { QueryHistoryProvider } from "./database/QueryHistoryProvider";
import { ErrorBoundary } from "./ErrorBoundary";
import { KeybindHelp } from "./keybinds/KeybindHelp";
import { KeybindProvider } from "./keybinds/KeybindProvider";
import { RouteProvider, Router } from "./Router";
import { SchemaProvider } from "./SchemaProvider";
import { SuspenseBoundary } from "./SuspenseBoundary";
import { TableProvider } from "./TableProvider";

export function App() {
  return (
    <SuspenseBoundary>
      <ErrorBoundary>
        <ConnectionCredentialsProvider>
          <ConfigurationProvider>
            <KeybindProvider>
              <QueryHistoryProvider>
                <RouteProvider>
                  <DatabaseProvider>
                    <SchemaProvider schemaName="public">
                      <TableProvider>
                        <KeybindHelp />
                        <CommandPalette />
                        <Router />
                      </TableProvider>
                    </SchemaProvider>
                  </DatabaseProvider>
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
