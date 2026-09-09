// @ts-nocheck
import { useEffect, useRef } from "react";

export default function Terminal({ widgetManager: { open, widgets } }) {
  const term = useRef(null);
  const elRef = useRef(null);
  useEffect(() => {
    (async () => {
      const { Terminal } = await import("xterm");
      const { FitAddon } = await import("xterm-addon-fit");

      term.current = new Terminal();
      const fitAddon = new FitAddon();
      term.current.loadAddon(fitAddon);

      const t = term.current;
      if (!t) {
        return;
      }

      if (!elRef.current) {
        return;
      }

      t.open(elRef.current);

      fitAddon.fit();

      t.onResize((evt) => {
        console.log("fit", evt);
      });

      t.write("Welcome to \x1B[1;3;31mOpenBB Workspace\x1B[0m\n\n\r");

      t.write("/ ➜ ");

      let buf = "";

      t.onKey((e) => {
        if (e.domEvent.keyCode === 13) {
          t.write("\r\n");
          console.log(buf);
          switch (buf) {
            case "actls":
              for (const widget of widgets) {
                t.write(`\x1B[1;3;31m"${widget.i}"\x1B[0m - ${widget.l}\n\r`);
              }
              break;
            case "shell":
              open({ t: "terminal", l: "Terminal • /", p: null, w: 3, h: 2 });
              break;
            case "candle aapl":
              open({ t: "candle-test", l: "Candle • /aapl", p: aapl });
              break;
            default:
              t.write(`Unknown command \x1B[1;3;31m"${buf}"\x1B[0m\n\r`);
              break;
          }

          buf = "";
          t.write("/ ➜ ");
          return;
        }

        if (e.domEvent.keyCode === 8) {
          buf = buf.replace(/.$/, "");
          t.write("\b \b");
          return;
        }

        buf += e.key;
        t.write(e.key);
      });
    })();
  }, []);
  return <div ref={elRef} className="h-full w-full" />;
}
