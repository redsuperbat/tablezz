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
      try {
        fitAddon.fit();

        if (!ref) {
          return;
        }

        const xtermScreen = ref.querySelector(".xterm-screen");

        if (!xtermScreen) {
          return;
        }

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
      } finally {
        invoke("create_pty", { cols: term.cols, rows: term.rows });
      }
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

  return <div ref={terminalRef} className="w-full h-full overflow-hidden" />;
}
