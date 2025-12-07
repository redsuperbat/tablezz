import { ConnectionCredentialsProvider } from "./ConnectionCredentialsProvider";
import { CommandLine } from "./commands/CommandLine";
import { CommandsProvider } from "./commands/CommandsContext";
import { ConfigurationProvider } from "./config/ConfigurationProvider";
import { QueryHistoryProvider } from "./database/QueryHistoryProvider";
import { DatabaseConnectionProvider } from "./database/useDatabase";
import { EditorProvider } from "./editor/useEditor";
import { KeybindHelp } from "./keybinds/KeybindHelp";
import { KeybindProvider } from "./keybinds/KeybindProvider";
import { Picker } from "./Picker";
import { RouteProvider, Router } from "./Router";
import { SchemaProvider } from "./SchemaProvider";
import { SelectedTableProvider } from "./SelectedTableProvider";
import { SqlCommandKeybind } from "./SqlCommandKeybind";
import { SuspenseBoundary } from "./SuspenseBoundary";

export function App() {
  return (
    <SuspenseBoundary>
      <CommandsProvider>
        <ConfigurationProvider>
          <KeybindProvider>
            <div
              class="grid h-screen overflow-hidden"
              style={{ "grid-template-rows": "1fr auto" }}
            >
              <KeybindHelp />

              <EditorProvider>
                <ConnectionCredentialsProvider>
                  <QueryHistoryProvider>
                    <DatabaseConnectionProvider>
                      <SqlCommandKeybind />
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
              </EditorProvider>

              <CommandLine />
            </div>
          </KeybindProvider>
        </ConfigurationProvider>
      </CommandsProvider>
    </SuspenseBoundary>
  );
}
