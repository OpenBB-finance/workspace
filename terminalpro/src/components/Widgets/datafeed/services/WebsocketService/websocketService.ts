import type { Dispatch, SetStateAction } from "react";

import type { LibrarySymbolInfo } from "~/lib/charting_library/charting_library";
import {
  type ConnectionError,
  type ConnectionHandler,
  ConnectionType,
  type HandlerType,
  type StreamingData,
  SubscribeItemStateType,
  SubscribeItemType,
  type SubscriptionItem,
} from "./type";
import { log, subscribeByType } from "./utils";
import { WebSocketAsync } from "./websocketAsync";
export const WS_SUBSCRIBE_FAILED_CODE = "WS-002";
export const WS_AUTH_FAILED_CODE = "WS-004";

const AUTHENTICATED_CHANNEL = "authenticated";

export class WebSocketClient {
  static _instance: WebSocketClient;
  _clientState: ConnectionType = ConnectionType.CLOSED;
  _ws: WebSocketAsync | null = null;
  _connectionString;
  _channels = new Map<string, SubscriptionItem>();
  _dispatch: Dispatch<SetStateAction<ConnectionType>> | undefined;

  constructor(connectionString: string | URL) {
    if (WebSocketClient._instance) {
      // biome-ignore lint/correctness/noConstructorReturn: Singleton pattern
      return WebSocketClient._instance;
    }
    WebSocketClient._instance = this;

    this._connectionString = connectionString;

    this.onMessage = this.onMessage.bind(this);
    this.onError = this.onError.bind(this);
    this.onClose = this.onClose.bind(this);
  }

  get ws(): WebSocketAsync | null {
    return this._ws;
  }

  set state(state) {
    this._dispatch?.(state);
    this._clientState = state;
  }

  get state(): ConnectionType {
    return this._clientState;
  }

  get channelStates(): Pick<SubscriptionItem, "channelId" | "subscribeItemState">[] {
    return Array.from(this._channels.values()).map((item) => ({
      channelId: item.channelId,
      subscribeItemState: item.subscribeItemState,
    })) as Pick<SubscriptionItem, "channelId" | "subscribeItemState">[];
  }

  get handlers(): ConnectionHandler[] {
    return Array.from(this._channels.values()).reduce((acc, curr) => {
      return acc.concat(curr.handlers);
    }, [] as ConnectionHandler[]);
  }

  async init(
    dispatch?: Dispatch<SetStateAction<ConnectionType>>,
  ): Promise<boolean | undefined> {
    try {
      if (!this._connectionString) {
        return;
      }

      this._ws = new WebSocketAsync(this._connectionString);

      const state = await this._ws.readyWatcher;

      this._ws.onMessageSync(this.onMessage);
      this._ws.onErrorSync(this.onError);
      this._ws.onCloseSync(this.onClose);

      if (dispatch) {
        this._dispatch = dispatch;
      }

      this.state = ConnectionType.READY;

      return state;
    } catch (e) {
      console.error("websocket service error", e);
    }
  }

  stop(): void {
    this._ws?.close();
    this._channels.clear();
  }

  onError(e: Event): void {
    log("[tvdf: handleError] error: ", e);

    const handlers = this.handlers;
    for (const handler of handlers) {
      handler.onError?.();
    }
    this._channels.clear();
    this.state = ConnectionType.ERROR;

    this.init();
  }

  onClose(e: CloseEvent): void {
    if (e.wasClean) {
      log(`[tvdf: handleClose]: code=${e.code} reason='${e.reason}'`);
    } else {
      console.error("[tvdf: handleClose]: connection died");
    }

    const handlers = this.handlers;
    for (const handler of handlers) {
      handler.onClose?.();
    }
    this._channels.clear();
    this.state = ConnectionType.ERROR;

    this.init();
  }

  sendMsg(msg: string): void {
    if (this.state === ConnectionType.READY && this._ws) {
      this._ws.send(msg);
    }
  }

  sendAuthMsg(access_token: string, params: unknown = {}): void {
    const msg = JSON.stringify({
      type: "authenticate",
      data: {
        access_token,
        params,
      },
    });

    this.sendMsg(msg);
  }

  subscribed(item: SubscriptionItem): void {
    item.subscribeItemState = SubscribeItemStateType.READY;

    for (const handler of item.handlers) {
      handler.onSubscribe?.();
    }
  }

  updated(item: SubscriptionItem, data: StreamingData): void {
    for (const handler of item.handlers) {
      handler.onMessage(data, item, handler);
    }
  }

  authenticated(item: SubscriptionItem, data: StreamingData): void {
    for (const handler of item.handlers) {
      handler.onMessage(data, item, handler);
    }
  }

  error(item: SubscriptionItem, data: ConnectionError): void {
    item.subscribeItemState = SubscribeItemStateType.ERROR;

    if (data.code === WS_SUBSCRIBE_FAILED_CODE) {
      this.unsubscribeByPattern("Notifications");
      this.unsubscribeByPattern("authenticated");

      return;
    }

    if (data.code === WS_AUTH_FAILED_CODE) {
      const channel = this._channels.get(data.channel_id);
      for (const handler of channel?.handlers || []) {
        handler.onError?.();
      }
      return;
    }

    for (const handler of item.handlers) {
      handler.onError?.();
    }
  }

  onMessage(e: MessageEvent): void {
    try {
      const msg: { type: HandlerType; data: StreamingData & ConnectionError } =
        JSON.parse(e.data);

      let channelKey = `${msg.type}`;
      console.log(msg);
      if (msg.type !== "authenticated") {
        channelKey = msg.data.channel_id;
      }
      const item = this._channels.get(channelKey);
      console.log(item);
      console.log(msg.type);

      if (item) {
        this[msg.type](item, msg.data);
      }
    } catch (err) {
      console.error(err);
      console.error("[tvdf]: error parsing incoming message", err);
    }
  }

  authenticate(
    access_token: string,
    handler: ConnectionHandler,
    params: unknown = {},
  ): void {
    if (this.state !== ConnectionType.READY) {
      return;
    }

    this._channels.set(AUTHENTICATED_CHANNEL, {
      channelId: AUTHENTICATED_CHANNEL,
      subscribed: false,
      subscribeItemState: SubscribeItemStateType.CONNECTING,
      type: SubscribeItemType.auth,
      params: {},
      handlers: [handler],
    });

    this.sendAuthMsg(access_token, params);
  }

  subscribe(
    channelId: string,
    type: SubscribeItemType,
    channelParams: { [key: string]: unknown },
    handler: ConnectionHandler,
    symbolInfo?: LibrarySymbolInfo,
  ): void {
    if (this.state !== ConnectionType.READY) {
      return;
    }

    const item = this._channels.get(channelId);

    if (item) {
      item.handlers = [...item.handlers, handler];
      return;
    }

    this._channels.set(channelId, {
      channelId: channelId,
      subscribed: false,
      subscribeItemState: SubscribeItemStateType.CONNECTING,
      type,
      params: { ...(channelParams ?? {}), symbol: symbolInfo?.ticker },
      handlers: [handler],
    });

    this.sendMsg(subscribeByType(type, channelId, channelId, symbolInfo));
  }

  unsubscribe(handlerId: string): void {
    const values = Array.from(this._channels.values());
    for (const channel of values) {
      const handlers = channel.handlers.filter((handler) => handler.uuid !== handlerId);
      channel.handlers = handlers;

      if (!handlers.length) {
        this.unsubscribeChannel(channel.channelId);
      }
    }
  }

  unsubscribeChannel(channelId: string): void {
    const item = this._channels.get(channelId);

    if (!item) {
      return;
    }

    item.subscribeItemState = SubscribeItemStateType.CLOSED;

    this._channels.delete(channelId);

    const unsubMsg = JSON.stringify({
      type: "unsubscribe",
      data: {
        channel_id: channelId,
        params: {
          subscriber_id: channelId,
          // @ts-expect-error
          symbol: item.params.symbol,
        },
      },
    });

    this.sendMsg(unsubMsg);
  }

  unsubscribeByPattern(pattern: string): void {
    const keys = Array.from(this._channels.keys());
    const channelIds = keys.filter((key) => key.includes(pattern));
    for (const channelId of channelIds) {
      this.unsubscribeChannel(channelId);
    }
  }
}
