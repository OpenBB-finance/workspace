import type { Bar, LibrarySymbolInfo } from "~/lib/charting_library";
import {
  ConnectionType,
  type HistoryUpdateData,
  MessageType,
  SubscribeItemType,
} from "./type";

export const ConnectionState: { [key: number]: ConnectionType } = {
  3: ConnectionType.CLOSED,
  2: ConnectionType.CLOSING,
  0: ConnectionType.CONNECTING,
  1: ConnectionType.OPEN,
};

export const log = (...args: unknown[]): void => {
  if (process.env.REACT_APP_TV_CHART_DEBUG === "true") {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};

export const subscribeByType = (
  type: SubscribeItemType,
  uuid: string,
  channel: string,
  symbolInfo?: LibrarySymbolInfo,
): string => {
  if (type === SubscribeItemType.chart) {
    return JSON.stringify({
      type: MessageType.subscribe,
      data: {
        channel_id: channel,
        params: {
          symbol: symbolInfo?.ticker,
          type: symbolInfo?.type,
          subscriber_id: uuid,
        },
      },
    });
  }

  if (type === SubscribeItemType.notify) {
    return JSON.stringify({
      type: MessageType.subscribe,
      data: {
        channel_id: channel,
        params: {
          symbol: symbolInfo?.ticker,
          type: symbolInfo?.type,
          subscriber_id: uuid,
        },
      },
    });
  }

  return "";
};

export const barMapper = (update: HistoryUpdateData): Bar => {
  const bar = {
    time: update.t_rounded * 1000,
    high: update.h,
    low: update.l,
    open: update.o,
    close: update.c,
    volume: update.v,
  };

  return bar;
};

export const setHighLowCandleValue = (prev: Bar, current: Bar): Bar => {
  const _current = { ...current };
  _current.open = prev.close;
  const maxOpen = Math.max(_current.open, _current.close);
  const minOpen = Math.min(_current.open, _current.close);

  if (_current.high < maxOpen) {
    _current.high = maxOpen;
  }

  if (_current.low > minOpen) {
    _current.low = minOpen;
  }

  return _current;
};
