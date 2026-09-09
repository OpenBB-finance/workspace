import type { Dispatch, SetStateAction } from "react";
import type { ConnectionType } from "~/components/Widgets/datafeed/services/WebsocketService/type";
import { WebSocketClient } from "./websocketService";

let ws: WebSocketClient;

export function getWsInstance(): WebSocketClient {
  if (!ws) {
    ws = new WebSocketClient("ws://localhost:6586/ws/channels");
  }
  return ws;
}

export const init = async (onStateChange: Dispatch<SetStateAction<ConnectionType>>) => {
  ws = getWsInstance();

  ws.init(onStateChange);
  return ws;
};

export default init;
