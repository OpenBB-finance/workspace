import type { ColDef } from "ag-grid-community";
import cloneDeep from "lodash/cloneDeep";
import { type Dispatch, type MutableRefObject, useEffect, useMemo } from "react";
import CellOnHover from "~/components/General/Table/CellRenderers/CellOnHover";
import { useIsFirstRender } from "~/components/General/Table/hooks/utils";
import { useWidgetContext } from "~/components/Widget.context";
import type { DispatchAction } from "~/hooks/useStateReducer";
import { useEquityComparePeers } from "~/lib/api/sdkComponents";
import { formatNumber } from "~/lib/utils";
import {
  VALUATION_COLS as METRICS_COLS,
  FINANCIAL_RATIO_COLS as RATIOS_COLS,
} from "../constants";
import type { PeersState, SelectedGroup, SelectedRatio } from "../types";

export function usePeersData(
  availableTickers: PeersState["availableTickers"],
  additionalPeersRef: MutableRefObject<string[]>,
  dispatch: Dispatch<DispatchAction<PeersState>>,
) {
  const { widget: { data: { mainTicker } = {} } = {} } = useWidgetContext();
  const isFirstRender = useIsFirstRender();

  useEffect(() => {
    if (!mainTicker?.symbol || isFirstRender) return;
    additionalPeersRef.current = [];
    dispatch({ availableTickers: [], additionalPeers: [] });
  }, [mainTicker, additionalPeersRef]);

  const { data } = useEquityComparePeers(
    {
      queryParams: {
        provider: "fmp",
        symbol: mainTicker?.symbol,
      },
    },
    {
      enabled: availableTickers.length === 0,
      staleTime: 1000 * 60 * 60 * 24,
      refetchInterval: 1000 * 60 * 60 * 24,
    },
  );

  const peersList = useMemo(() => {
    if (!data?.results?.peers_list) return null;
    // Get secondaryTickers from widget data
    const newPeers = data.results.peers_list?.map((item) => {
      return item?.replace(".", "-").replace("/", "-");
    });
    const secondaryTickers = additionalPeersRef.current;

    // Filter out tickers that are already in peers_list
    const newTickers = secondaryTickers.filter((ticker) => !newPeers.includes(ticker));

    // If there are any new tickers, append them to peers_list
    if (newTickers.length > 0) newPeers.push(...newTickers);

    newPeers.unshift(mainTicker.symbol);

    return Array.from(new Set(newPeers)) as string[];
  }, [data, additionalPeersRef]);

  useEffect(() => {
    if (!peersList?.length || availableTickers.length > 0) return;
    additionalPeersRef.current = peersList;
    dispatch({ additionalPeers: peersList });
  }, [peersList, additionalPeersRef]);
}

type PrepareColumnDefs = {
  group: SelectedGroup;
  ratio: SelectedRatio;
  decimalDigitsToUse: number;
};

export function prepareColumnDefs(props: PrepareColumnDefs) {
  const { group, ratio, decimalDigitsToUse } = props;
  const colDefs = {
    valuation_multiples: cloneDeep(METRICS_COLS),
    financial_ratios: cloneDeep(RATIOS_COLS[ratio]),
  } as Record<SelectedGroup, ColDef[]>;

  return colDefs?.[group]?.map((col) => {
    if (!col?.cellRenderer) {
      col.cellRenderer = (params) => {
        let value = params.value;
        if (typeof params.value === "number") {
          value = formatNumber(params.value, decimalDigitsToUse);
          if (col.field === "dividend_yield") {
            const [int, decimals = "0"] = (params.value * 100).toString().split(".");
            value = `${int}.${decimals?.slice(0, Math.max(2, decimalDigitsToUse))} %`;
          }
        }

        if (!params.value) return "-";
        return (
          <CellOnHover
            value={value}
            title={params.value?.toString()}
            colorValue={params.value}
          />
        );
      };
    }

    if (col.type === "numericColumn") {
      col.chartDataType = "series" as const;
    }
    return col;
  });
}
