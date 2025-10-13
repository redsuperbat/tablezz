import { Toaster } from "@/components/ui/toast";
import { ConnectionCredentialsProvider } from "./ConnectionCredentialsProvider";
import { CommandPalette } from "./commands/CommandPalette";
import { CommandsProvider } from "./commands/CommandsContext";
import { ConfigurationProvider } from "./config/ConfigurationProvider";
import { QueryHistoryProvider } from "./database/QueryHistoryProvider";
import { DatabaseConnectionProvider } from "./database/useDatabase";
import { KeybindHelp } from "./keybinds/KeybindHelp";
import { KeybindProvider } from "./keybinds/KeybindProvider";
import { Picker } from "./Picker";
import { RouteProvider, Router } from "./Router";
import { SchemaProvider } from "./SchemaProvider";
import { SelectedTableProvider } from "./SelectedTableProvider";
import { SuspenseBoundary } from "./SuspenseBoundary";

export function App() {
  return (
    <SuspenseBoundary>
      <ConnectionCredentialsProvider>
        <QueryHistoryProvider>
          <DatabaseConnectionProvider>
            <ConfigurationProvider>
              <CommandsProvider>
                <KeybindProvider>
                  <CommandPalette />
                  <RouteProvider>
                    <SchemaProvider>
                      <SelectedTableProvider>
                        <KeybindHelp />
                        <Picker />
                        <Router />
                      </SelectedTableProvider>
                    </SchemaProvider>
                  </RouteProvider>
                </KeybindProvider>
              </CommandsProvider>
            </ConfigurationProvider>
          </DatabaseConnectionProvider>
        </QueryHistoryProvider>
      </ConnectionCredentialsProvider>
      <Toaster />
    </SuspenseBoundary>
  );
}
