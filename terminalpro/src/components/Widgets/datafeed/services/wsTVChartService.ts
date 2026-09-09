import dayjs from "dayjs";
import { getWsInstance } from "~/components/Widgets/datafeed/services/WebsocketService";
import {
  type ConnectionHandler,
  type StreamingData,
  SubscribeItemType,
  type SubscriptionItem,
} from "~/components/Widgets/datafeed/services/WebsocketService/type";
import type {
  Bar,
  LibrarySymbolInfo,
  ResolutionString,
  SubscribeBarsCallback,
} from "~/lib/charting_library/datafeed-api";
import { barMapper, buildChannelKey, setHighLowCandleValue } from "../helper";

export const updateBars = (
  data: unknown,
  subscriptionItem?: SubscriptionItem,
  handler?: ConnectionHandler,
): Bar | undefined => {
  if (!(subscriptionItem && handler?.params)) {
    return;
  }

  console.log("updateBars", { data, subscriptionItem, handler });
  const { update } = data as StreamingData;
  const params = subscriptionItem.params as { lastCandleTime: number };
  const handlerParams = handler.params as { lastBar: Bar };
  console.log(update);
  update.t_rounded = dayjs(update.t)
    .tz("America/New_York")
    .second(0)
    .millisecond(0)
    .unix();

  console.log("updateBars", update.t_rounded);

  // check with last bar and not update if older
  if (update.t_rounded < params.lastCandleTime) {
    console.log("updateBars", "update.t_rounded < params.lastCandleTime");
    return;
  }
  // update last saved candle
  params.lastCandleTime = update.t_rounded;
  update.h = handlerParams.lastBar.high;
  update.l = handlerParams.lastBar.low;
  update.o = handlerParams.lastBar.open;

  try {
    let bar = barMapper(update);
    if (handlerParams.lastBar.time !== bar.time) {
      bar = setHighLowCandleValue(handlerParams.lastBar, bar);
    }
    handlerParams.lastBar = bar;
    console.log(bar);
    return bar;
  } catch (err) {
    console.error("[tvdf: update] error: ", err);
  }
};

export const wsTVChartService = {
  subscribeBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    onRealtimeCallback: SubscribeBarsCallback,
    subscriberId: string,
    chartId: string,
    lastCandleTimestamp?: number,
  ): void {
    if (!symbolInfo.ticker) {
      return;
    }
    const channelId = buildChannelKey(symbolInfo.ticker, resolution) || "";
    const ws = getWsInstance();
    const onMessageHandler = (
      data: unknown,
      subscriptionItem?: SubscriptionItem,
      handler?: ConnectionHandler,
    ): void => {
      const bar = updateBars(data, subscriptionItem, handler);
      console.log("onMessageHandler", { data, subscriptionItem, handler });
      bar && onRealtimeCallback(bar);
    };

    const handler = {
      uuid: `${subscriberId}-${chartId}`,
      reconnect: false,
      onMessage: onMessageHandler,
      params: { lastBar: lastCandleTimestamp },
    };

    ws.subscribe(channelId, SubscribeItemType.chart, {}, handler, symbolInfo);
  },

  unsubscribeBars(subscriberId: string, chartId: string): void {
    const ws = getWsInstance();
    ws.unsubscribe(`${subscriberId}-${chartId}`);
  },
};
