import type { PeriodParamsWithOptionalCountback } from "~/components/Widgets/datafeed/history-provider";
import type { UDFSearchResult } from "~/lib/api/sdkSchemas";
import type { Bar, IBasicDataFeed } from "~/lib/charting_library/charting_library";
import type {
  ErrorCallback,
  HistoryCallback,
  HistoryMetadata,
  LibrarySymbolInfo,
} from "~/lib/charting_library/datafeed-api";

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

export interface ChartDataFeed extends IBasicDataFeed {
  processGetBars: (props: {
    symbolInfo: LibrarySymbolInfo;
    data?: {
      bars?: Bar[];
      s: "ok" | "no_data" | "error";
      errmsg?: string;
    };
    meta: HistoryMetadata;
    onHistoryCallback: HistoryCallback;
    onErrorCallback: ErrorCallback;
    periodParams?: PeriodParamsWithOptionalCountback;
    from?: number;
  }) => void;
  chartId?: string;
  subscriberId?: string;
  lastBar?: Bar;
  _keepFetching: boolean;
  _lastCandleTimestamp?: number;
  lastFredCall?: number;
  getChartId?: () => string;
}

export type WeightedItem = {
  symbolInfo: UDFSearchResult;
  weight: number;
};
