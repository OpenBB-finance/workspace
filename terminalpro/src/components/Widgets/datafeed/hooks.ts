import type { usePostHog } from "posthog-js/react";
import { useContext, useEffect, useRef } from "react";
import type { Ticker, WidgetT } from "~/components/types";
import type {
  IChartingLibraryWidget,
  IChartWidgetApi,
  LibrarySymbolInfo,
} from "~/lib/charting_library/charting_library";
import { useChartingStore } from "~/lib/state/charting";
import { tickerCategories } from "../Helpers/AdvancedSelectedTickers";
import { balanceIndicatorName } from "../TVStudies/Balance";
import { cashFlowIndicatorName } from "../TVStudies/CashFlow";
import { incomeIndicatorName } from "../TVStudies/Income";
import { ConnectionType } from "./services/WebsocketService/type";
import websocketServiceContext from "./services/WebsocketService/wsContext";

export const useComponentDidMount = (effectOnMount: () => void): void => {
  useEffect(() => {
    return effectOnMount();
  }, []);
};

export function usePrevWebsocketState(cb: () => void): void {
  const { ws, wsState } = useContext(websocketServiceContext);
  const prevWsState = useRef("");

  useEffect(() => {
    if (wsState === ConnectionType.ERROR) {
      prevWsState.current = ConnectionType.ERROR;
    }
    if (
      wsState === ConnectionType.READY &&
      prevWsState.current === ConnectionType.ERROR
    ) {
      cb();
      prevWsState.current = "";
    }
  }, [cb, ws, wsState]);
}

export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}

export function onTASecondTickers(
  activeChart: IChartWidgetApi,
  tickers: string[],
  ta: boolean,
) {
  for (const study of activeChart.getAllStudies()) {
    if (
      (tickers && study.name === "Compare") ||
      (ta && ["Volume", "Moving Average"].includes(study.name))
    ) {
      activeChart.removeEntity(study.id);
    }
  }

  if (tickers?.length) {
    setTimeout(() => {
      activeChart.setChartType(2, () => {});
    }, 0);
    const currentSymbol = activeChart.symbol();
    for (const ticker of tickers) {
      if (ticker === currentSymbol) continue;
      activeChart.createStudy("Compare", false, false, {
        source: "close",
        symbol: ticker,
      });
    }
  }
  if (ta) {
    activeChart.createStudy("Moving Average", false, false, {
      length: 20,
      source: "close",
    });
    activeChart.createStudy("Volume", true, false, undefined, {
      showLabelsOnPriceScale: false,
    });
  }
}

interface OnSymbolChangedProps {
  activeDashboardId: string | null;
  getWidget?: () => WidgetT;
  tvWidget: IChartingLibraryWidget;
  secondTickers: string[];
  posthog: ReturnType<typeof usePostHog>;
  updateWidget?: (newWidget: WidgetT | ((prev: WidgetT) => WidgetT)) => void;
}

export function onSymbolChanged({
  activeDashboardId,
  getWidget,
  tvWidget,
  secondTickers,
  posthog,
  updateWidget,
}: OnSymbolChangedProps): void {
  tvWidget
    .activeChart()
    .onSymbolChanged()
    .subscribe(
      null,
      // @ts-expect-error
      (
        symbolData: LibrarySymbolInfo & {
          type: string;
          symbol: string;
          frequency: string;
        },
      ) => {
        const { changeSymbol, getSymbol } = useChartingStore.getState();
        const widget = getWidget();

        const symbol = getSymbol(widget?.id || "charting_page");

        if (posthog && symbolData?.ticker !== symbol) {
          posthog.capture("TV_changed_ticker", {
            ticker: symbolData.symbol,
            type_of_widget: widget?.type || "TV-charting",
          });
        }

        if (symbolData?.type !== "economic" && !secondTickers?.length) {
          if (!tvWidget.layoutName()) tvWidget.activeChart().setChartType(1, () => {});
        }

        for (const study of tvWidget.activeChart().getAllStudies()) {
          if (
            [incomeIndicatorName, balanceIndicatorName, cashFlowIndicatorName].includes(
              study.name,
            )
          ) {
            tvWidget
              .activeChart()
              .getStudyById(study.id)
              .setVisible(symbolData?.type === "stock");
          }
        }

        if (symbolData?.ticker !== widget?.data?.mainTicker?.symbol) {
          changeSymbol(widget?.id || "charting_page", symbolData.ticker);
          if (activeDashboardId && widget) {
            queueMicrotask(() =>
              updateWidget((prev) => ({
                ...prev,
                data: {
                  ...prev.data,
                  mainTicker: {
                    symbol: symbolData.ticker,
                    exchange: symbolData.exchange,
                    name: symbolData.description,
                    type: symbolData.type as Ticker["type"],
                    category: tickerCategories?.[symbolData.type] || "equity",
                    id: symbolData.symbol,
                  },
                },
                storage: {
                  ...(prev?.storage || {}),
                  params: {
                    ...(prev?.storage?.params || {}),
                    symbol: symbolData.ticker,
                  },
                },
              })),
            );
            return;
          }
        }
      },
    );
}
