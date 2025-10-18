import { ConnectionCredentialsProvider } from "./ConnectionCredentialsProvider";
import { CommandLine } from "./commands/CommandLine";
import { CommandsProvider } from "./commands/CommandsContext";
import { ConfigurationProvider } from "./config/ConfigurationProvider";
import { QueryHistoryProvider } from "./database/QueryHistoryProvider";
import { DatabaseConnectionProvider } from "./database/useDatabase";
import { FocusInputKeybind } from "./FocusInputKeybind";
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
      <CommandsProvider>
        <ConfigurationProvider>
          <KeybindProvider>
            <div
              class="grid h-screen"
              style={{ "grid-template-rows": "1fr auto" }}
            >
              <FocusInputKeybind />
              <KeybindHelp />

              <ConnectionCredentialsProvider>
                <QueryHistoryProvider>
                  <DatabaseConnectionProvider>
                    <RouteProvider>
                      <SchemaProvider>
                        <SelectedTableProvider>
                          <Picker />
                          <Router />
                        </SelectedTableProvider>
                      </SchemaProvider>
                    </RouteProvider>
                  </DatabaseConnectionProvider>
                </QueryHistoryProvider>
              </ConnectionCredentialsProvider>

              <CommandLine />
            </div>
          </KeybindProvider>
        </ConfigurationProvider>
      </CommandsProvider>
    </SuspenseBoundary>
  );
}
