export interface ConnectionHandler {
  uuid: string;
  reconnect: boolean;
  onMessage: (
    data: unknown,
    item?: SubscriptionItem,
    handler?: ConnectionHandler,
  ) => void;
  onError?: () => void;
  onReconnect?: () => void;
  onSubscribe?: () => void;
  onClose?: () => void;
  params?: unknown;
}
export interface SubscriptionItem {
  type: SubscribeItemType;
  subscribed: boolean;
  subscribeItemState: SubscribeItemStateType;
  params: unknown;
  handlers: ConnectionHandler[];
  channelId: string; // duplicate
}

export interface HistoryFullDataResponse {
  t: number[];
  c: string[];
  o: string[];
  h: string[];
  l: string[];
  v: string[];
  t_rounded: number;
  s: string;
  nextTime: number;
}

export interface HistoryUpdateData {
  t: number;
  c: number;
  o: number;
  h: number;
  l: number;
  v: number;
  t_rounded: number;
  s: string;
  nextTime: number;
}

export interface StreamingData {
  channel_id: string;
  update: HistoryUpdateData;
  params: { subscriber_id: string };
  nextTime: number;
}

export interface ConnectedEvent extends Event {
  app?: {
    version?: string;
  };
}

export enum ConnectionType {
  CLOSED = "CLOSED",
  CLOSING = "CLOSING",
  CONNECTING = "CONNECTING",
  OPEN = "OPEN",
  READY = "READY",
  ERROR = "ERROR",
}

export enum SubscribeItemStateType {
  ERROR = "ERROR",
  CLOSED = "CLOSED",
  CONNECTING = "CONNECTING",
  READY = "READY",
}

export enum SubscribeItemType {
  chart = "chart",
  notify = "notify",
  auth = "auth",
}

export enum MessageType {
  subscribe = "subscribe",
  subscribed = "subscribed",
  updated = "updated",
  connected = "connected",
  unsubscribed = "unsubscribed",
  error = "error",
  authenticated = "authenticated",
}

export type HandlerType = "subscribed" | "updated" | "error" | "authenticated";
export interface ConnectionError {
  code: string;
  message: string;
  channel_id: string;
  params: { [key: string]: unknown };
}
