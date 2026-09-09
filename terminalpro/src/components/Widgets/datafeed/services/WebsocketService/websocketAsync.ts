import { ConnectionState } from "./utils";

export class WebSocketAsync extends WebSocket {
  _readyWatcher;

  constructor(url: string | URL) {
    super(url);
    this._readyWatcher = this.ready();
  }

  ready(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.addEventListener("error", (e) => {
        reject(e);
      });

      this.addEventListener("open", () => {
        resolve(true);
      });
    });
  }

  get readyWatcher(): Promise<boolean> {
    return this._readyWatcher;
  }

  get state(): string {
    return ConnectionState[this.readyState];
  }

  onErrorSync(cb: (e: Event) => void): void {
    this.addEventListener("error", (e) => {
      console.error("websocket error", e);

      cb?.(e);
    });
  }

  onCloseSync(cb: (e: CloseEvent) => void): void {
    this.addEventListener("close", (e) => {
      cb?.(e);
    });
  }

  onMessageSync(cb: (msg: MessageEvent) => void): void {
    this.addEventListener("message", (e) => {
      cb?.(e);
    });
  }
}
