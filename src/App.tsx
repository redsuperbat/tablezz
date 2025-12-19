import { ConnectionCredentialsProvider } from "./ConnectionCredentialsProvider";
import { CommandLine } from "./commands/CommandLine";
import { CommandsProvider } from "./commands/CommandsContext";
import { ConfigurationProvider } from "./config/ConfigurationProvider";
import { QueryHistoryProvider } from "./database/QueryHistoryProvider";
import { DatabaseConnectionProvider } from "./database/useDatabase";
import { ErrorBoundary } from "./ErrorBoundary";
import { EditorProvider } from "./editor/useEditor";
import { PickerProvider } from "./picker/usePicker";
import { GlobalKeybinds } from "./GlobalKeybinds";
import { HopProvider } from "./HopContext";
import { AllKeybindsHelp } from "./keybinds/AllKeybindsHelp";
import { KeybindProvider } from "./keybinds/KeybindProvider";
import { PotentialKeybindHelp } from "./keybinds/PotentialKeybindHelp";
import { Picker } from "./Picker";
import { RouteProvider, Router } from "./Router";
import { SchemaProvider } from "./SchemaProvider";
import { SelectedTableProvider } from "./SelectedTableProvider";
import { SuspenseBoundary } from "./SuspenseBoundary";

export function App() {
  return (
    <ErrorBoundary>
      <SuspenseBoundary>
        <CommandsProvider>
          <ConfigurationProvider>
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
                            <HopProvider>
                              <SchemaProvider>
                                <SelectedTableProvider>
                                  <Picker />
                                  <Router />
                                </SelectedTableProvider>
                              </SchemaProvider>
                            </HopProvider>
                          </RouteProvider>
                        </DatabaseConnectionProvider>
                      </QueryHistoryProvider>
                    </ConnectionCredentialsProvider>
                  </PickerProvider>
                </EditorProvider>

                <CommandLine />
              </div>
            </KeybindProvider>
          </ConfigurationProvider>
        </CommandsProvider>
      </SuspenseBoundary>
    </ErrorBoundary>
  );
}
