import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef } from "react";
import "@xterm/xterm/css/xterm.css";

export function SqlEditor() {
  const terminalRef = useRef(null);

  useEffect(() => {
    const ref = terminalRef.current;
    if (!ref) return;
    const term = new Terminal();
    term.open(ref);

    term.onData((data) => invoke("write_to_pty", { data }));

    listen("pty-output", (event) => term.write(event.payload as string));

    invoke("create_pty");

    return () => term.dispose();
  }, []);

  return <div ref={terminalRef} className="w-full h-full" />;
}
