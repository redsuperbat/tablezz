import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { onCleanup, onMount } from "solid-js";
import { useConfig } from "@/config/ConfigurationProvider";

export function Editor(props: {
  onExit(value: string): void;
  initialContent: string;
  extension?: string;
}) {
  const { config } = useConfig();

  let terminalRef: HTMLDivElement | undefined;
  const term = new Terminal({ fontFamily: "Fira Code" });
  const fitAddon = new FitAddon();
  const disposables = new Set<() => void>();

  term.loadAddon(fitAddon);

  function resizeTerm() {
    fitAddon.fit();

    const ref = terminalRef;
    if (!ref) return;

    const xtermScreen = ref.querySelector(".xterm-screen");
    if (!xtermScreen) return;

    const charWidth = xtermScreen.clientWidth / term.cols;
    const charHeight = xtermScreen.clientHeight / term.rows;

    const terminalWidth = term.cols * charWidth;
    const terminalHeight = term.rows * charHeight;

    const containerWidth = ref.clientWidth;
    const containerHeight = ref.clientHeight;

    const paddingRight = Math.floor((containerWidth - terminalWidth) / 2);
    const paddingLeft = Math.ceil((containerWidth - terminalWidth) / 2);
    const paddingTop = Math.floor((containerHeight - terminalHeight) / 2);
    const paddingBottom = Math.ceil((containerHeight - terminalHeight) / 2);

    ref.style.paddingRight = `${paddingRight}px`;
    ref.style.paddingLeft = `${paddingLeft}px`;
    ref.style.paddingTop = `${paddingTop}px`;
    ref.style.paddingBottom = `${paddingBottom}px`;
  }

  const resizeObserver = new ResizeObserver(resizeTerm);

  onMount(() => {
    const ref = terminalRef;
    if (!ref) return;

    term.open(ref);

    requestAnimationFrame(() => {
      resizeTerm();

      invoke("create_pty", {
        cols: term.cols,
        rows: term.rows,
        initialContent: props.initialContent,
        extension: props.extension,
        editor: config.editor,
      });

      term.focus();
    });

    term.onData((data) => invoke("write_to_pty", { data }));
    term.onResize(({ cols, rows }) => invoke("resize_pty", { cols, rows }));

    window.addEventListener("resize", resizeTerm);
    resizeObserver.observe(ref);

    listen("pty-output", (event) => {
      const data = String(event.payload);
      term.write(data);
    }).then((o) => disposables.add(o));

    listen("pty-exit", (event) => {
      const data = String(event.payload).trim();
      try {
        props.onExit(data);
      } catch {
        // do nothing
      }
    }).then((o) => disposables.add(o));
  });

  onCleanup(() => {
    window.removeEventListener("resize", resizeTerm);
    resizeObserver.disconnect();
    term.dispose();

    // Dispose all disposables
    disposables.forEach((o) => {
      o();
    });
  });

  return <div ref={terminalRef} class="h-full w-full" />;
}
