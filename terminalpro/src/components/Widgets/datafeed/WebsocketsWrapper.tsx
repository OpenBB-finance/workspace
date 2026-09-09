import React from "react";
import { useComponentDidMount } from "./hooks";
import wsInit from "./services/WebsocketService";
import { ConnectionType } from "./services/WebsocketService/type";
import type { WebSocketClient } from "./services/WebsocketService/websocketService";
import WebsocketServiceContext from "./services/WebsocketService/wsContext";

const WebsocketsWrapper = (props: { children: React.ReactNode }) => {
  const [wsClient, setWsClient] = React.useState<WebSocketClient | null>(null);
  const [wsClientState, setWsClientState] = React.useState<ConnectionType>(
    ConnectionType.CLOSED,
  );
  const [wsJti] = React.useState<string>();

  useComponentDidMount(() => {
    wsInit(setWsClientState).then((ws) => {
      setWsClient(ws);
    });
  });

  return (
    <WebsocketServiceContext.Provider
      value={{ ws: wsClient, wsState: wsClientState, jti: wsJti }}
    >
      {props.children}
    </WebsocketServiceContext.Provider>
  );
};

export default WebsocketsWrapper;
