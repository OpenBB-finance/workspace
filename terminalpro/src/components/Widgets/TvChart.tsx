import { useMemo } from "react";
import { useShallowChartingStore } from "~/lib/state/charting";

import { useWidgetContext } from "../Widget.context";
import TVChartContainerFunc from "./TVChartContainer/TVChartContainerFunc";

const TvChart = (props: {
  ticker?: string;
  simpleChart?: boolean;
  extraClassName?: string;
  secondTickers?: string[];
  showTA?: boolean;
  tvRef?: any;
}) => {
  const {
    id: widgetUuid,
    data: { mainTicker, secondaryTickers } = {},
    storage: { params } = {},
  } = useWidgetContext(true).widget || {};

  const getSymbol = useShallowChartingStore((state) => state.getSymbol);

  const symbol = getSymbol(widgetUuid || "charting_page");

  const {
    ticker = params?.symbol || mainTicker?.symbol || symbol,
    simpleChart = false,
    extraClassName = "m-2 h-[calc(100%-16px)] _widget-content",
    secondTickers = secondaryTickers?.map((ticker) => ticker.symbol) || [],
    showTA = false,
    tvRef,
  } = props;

  return useMemo(
    () => (
      <TVChartContainerFunc
        ref={tvRef}
        ticker={ticker}
        extraClassName={extraClassName}
        simpleChart={simpleChart}
        secondTickers={secondTickers}
        showTA={showTA}
      />
    ),
    [tvRef, ticker, extraClassName, simpleChart, secondTickers, showTA],
  );
};

export default TvChart;
