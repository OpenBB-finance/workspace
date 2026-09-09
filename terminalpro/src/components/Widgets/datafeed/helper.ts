import type { Bar } from "~/lib/charting_library";
import type { HistoryUpdateData } from "./type";

export const isWebsocketFeatureEnabled = false;

export const log = (...args: unknown[]): void => {
  console.log(...args);
};

export const buildChannelKey = (
  ticker: string,
  resolution: string,
): string | undefined => {
  try {
    const interval = Number.parseInt(resolution, 10) * 60;
    const [symbol, appendix] = ticker.split("-");
    const [_ticker, type, period] = ticker.split("-");

    console.log("buildChannelKey", { symbol, appendix, interval });

    if (type || period) return;

    return `${symbol}-${interval}`;
  } catch (err) {
    console.error("Error while generating channelId", {
      error: err,
      ticker,
      resolution,
    });
    return;
  }
};

export const barMapper = (update: HistoryUpdateData): Bar => {
  const bar = {
    time: update?.t_rounded * 1000,
    high: update?.h ?? update.c,
    low: update?.l ?? update.c,
    open: update?.o ?? update.c,
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
