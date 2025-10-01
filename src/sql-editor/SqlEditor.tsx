import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef } from "react";
import "@xterm/xterm/css/xterm.css";

export function SqlEditor({ onClose }: { onClose: () => void }) {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ref = terminalRef.current;
    if (!ref) return;

    const term = new Terminal({ fontFamily: "Fira Code" });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(ref);

    requestAnimationFrame(() => {
      fitAddon.fit();
      invoke("create_pty", { cols: term.cols, rows: term.rows });
    });

    term.onData((data) => invoke("write_to_pty", { data }));
    term.onResize(({ cols, rows }) => invoke("resize_pty", { cols, rows }));

    const handleResize = () => fitAddon.fit();

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(ref);

    const output = listen("pty-output", (event) => {
      const data = String(event.payload);
      term.write(data);
    });

    const exit = listen("pty-exit", onClose);

    term.focus();

    return () => {
      resizeObserver.disconnect();
      output.then((o) => o());
      exit.then((o) => o());
      term.dispose();
    };
  }, [onClose]);

  return <div ref={terminalRef} className="w-full h-full" />;
}
