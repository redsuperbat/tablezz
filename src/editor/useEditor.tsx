import {
  createContext,
  createSignal,
  type ParentProps,
  Show,
  useContext,
} from "solid-js";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Editor } from "./Editor";

interface EditorOptions {
  initialContent: string;
  extension?: string;
}

interface EditorContextValue {
  open: (options: EditorOptions) => Promise<string>;
}

const EditorContext = createContext<EditorContextValue>();

export function EditorProvider(props: ParentProps) {
  const [state, setState] = createSignal<{
    options: EditorOptions;
    resolve: (value: string) => void;
  }>();

  function open(options: EditorOptions): Promise<string> {
    return new Promise((resolve) => {
      setState({ options, resolve });
    });
  }

  return (
    <EditorContext.Provider value={{ open }}>
      {props.children}
      <Dialog modal open={!!state()}>
        <DialogContent
          onEscapeKeyDown={(e) => e.preventDefault()}
          class="flex h-[80vh] max-w-[80vw] flex-col justify-start border-none p-0 shadow-none"
        >
          <Show when={state()}>
            {(current) => (
              <Editor
                extension={current().options.extension}
                initialContent={current().options.initialContent}
                onExit={(data) => {
                  const resolve = current().resolve;
                  setState(undefined);
                  resolve(data);
                }}
              />
            )}
          </Show>
        </DialogContent>
      </Dialog>
    </EditorContext.Provider>
  );
}

export function useEditor() {
  const context = useContext(EditorContext);

  if (!context) {
    throw new Error("useEditor must be used within an EditorProvider");
  }

  return context;
}
