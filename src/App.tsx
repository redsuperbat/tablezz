import { Toaster } from "@/components/ui/sonner";
import { CommandPalette } from "./CommandPalette";
import { ConfigurationProvider } from "./config/ConfigurationProvider";
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
        <KeybindProvider>
          <QueryHistoryProvider>
            <ConfigurationProvider>
              <RouteProvider>
                <SchemaProvider schemaName="public">
                  <TableProvider>
                    <KeybindHelp />
                    <CommandPalette />
                    <Router />
                  </TableProvider>
                </SchemaProvider>
              </RouteProvider>
            </ConfigurationProvider>
          </QueryHistoryProvider>
        </KeybindProvider>
      </ErrorBoundary>
      <Toaster />
    </SuspenseBoundary>
  );
}
