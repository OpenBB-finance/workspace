import { createContext } from "react";

import { ConnectionType } from "./type";
import type { WebSocketClient } from "./websocketService";

export type WebsocketServiceContext = {
  ws: WebSocketClient | null;
  wsState: ConnectionType;
  jti?: string;
};
const websocketServiceContext = createContext<WebsocketServiceContext>({
  ws: null,
  wsState: ConnectionType.CLOSED,
});

export default websocketServiceContext;
