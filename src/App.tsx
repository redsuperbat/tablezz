import { ConnectionCredentialsProvider } from "./ConnectionCredentialsProvider";
import { CommandLine } from "./commands/CommandLine";
import { CommandsProvider } from "./commands/CommandsContext";
import { ConfigurationProvider } from "./config/ConfigurationProvider";
import { QueryHistoryProvider } from "./database/QueryHistoryProvider";
import { DatabaseConnectionProvider } from "./database/useDatabase";
import { ErrorBoundary } from "./ErrorBoundary";
import { EditorProvider } from "./editor/useEditor";
import { GlobalKeybinds } from "./GlobalKeybinds";
import { HopProvider } from "./HopContext";
import { AllKeybindsHelp } from "./keybinds/AllKeybindsHelp";
import { KeybindProvider } from "./keybinds/KeybindProvider";
import { PotentialKeybindHelp } from "./keybinds/PotentialKeybindHelp";
import { Picker } from "./Picker";
import { PickerProvider } from "./picker/usePicker";
import { RouteProvider, Router } from "./Router";
import { SchemaProvider } from "./SchemaProvider";
import { SelectedTableProvider } from "./SelectedTableProvider";
import { SuspenseBoundary } from "./SuspenseBoundary";

export function App() {
  return (
    <ErrorBoundary>
      <SuspenseBoundary>
        <HopProvider>
          <ConfigurationProvider>
            <CommandsProvider>
              <KeybindProvider>
                <div
                  class="grid h-screen overflow-hidden"
                  style={{ "grid-template-rows": "1fr auto" }}
                >
                  <AllKeybindsHelp />
                  <PotentialKeybindHelp />

                  <EditorProvider>
                    <PickerProvider>
                      <ConnectionCredentialsProvider>
                        <QueryHistoryProvider>
                          <DatabaseConnectionProvider>
                            <GlobalKeybinds />
                            <RouteProvider>
                              <SchemaProvider>
                                <Picker />
                                <SelectedTableProvider>
                                  <Router />
                                </SelectedTableProvider>
                              </SchemaProvider>
                            </RouteProvider>
                          </DatabaseConnectionProvider>
                        </QueryHistoryProvider>
                      </ConnectionCredentialsProvider>
                    </PickerProvider>
                  </EditorProvider>

                  <CommandLine />
                </div>
              </KeybindProvider>
            </CommandsProvider>
          </ConfigurationProvider>
        </HopProvider>
      </SuspenseBoundary>
    </ErrorBoundary>
  );
}
