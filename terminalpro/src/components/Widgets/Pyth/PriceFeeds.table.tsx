import type {
  GetContextMenuItemsParams,
  GetRowIdFunc,
  GetRowIdParams,
  GridReadyEvent,
} from "ag-grid-community";
import { useCallback, useEffect, useMemo } from "react";
import DraggableCard from "~/components/DraggableCard";
import { getContextMenuItems } from "~/components/General/Table/AgGridUtils";
import {
  AgGridProvider,
  ensureAgGrid,
  useAgGridContext,
} from "~/components/General/Table/hooks";
import { useWidgetParamsPositions } from "~/components/General/Table/NavBar/QueryParams";
import { useWidgetContext } from "~/components/Widget.context";
import { formatPrice } from "~/components/Widgets/Pyth/utils";
import { useHistoricalPrices } from "~/hooks/fetching/pyth/useHistoricalPrices";
import { usePriceChanges } from "~/hooks/fetching/pyth/usePriceChange";
import { usePythPriceMetadata } from "~/hooks/fetching/pyth/usePythPriceMetadata";
import { ensureArray } from "~/lib/utils";
import { formatPercentage } from "../Currency/CurrencySnapshot";

const defaultSymbols = [
  "Crypto.BTC/USD",
  "Crypto.PYTH/USD",
  "Equity.US.SPY/USD",
  "Equity.US.QQQ/USD",
  "Equity.US.DOW/USD",
  "Equity.US.AAPL/USD",
  "FX.EUR/USD",
  "Metal.XAU/USD",
];

export default function PythPriceFeedsTable() {
  const {
    widget: { id: widgetUuid, storage: { params } = {} },
  } = useWidgetContext();

  const { data: priceMetadata } = usePythPriceMetadata();
  const { isLoading, data, dataUpdatedAt, error } = useHistoricalPrices();
  const gridRef = useAgGridContext()?.gridRef;

  const symbols = useMemo(
    () => ensureArray(params?.symbols, defaultSymbols),
    [params?.symbols],
  );

  const priceFeeds = useMemo(() => {
    if (!priceMetadata) return [];

    return symbols.map((symbol) => ({ symbol, feedId: priceMetadata[symbol]?.feedId }));
  }, [symbols, priceMetadata]);

  const tableData = useMemo(() => {
    if (!data) return null;

    return data.reduce((acc, item) => {
      if (symbols.includes(item.symbol)) {
        acc.push({
          ...item,
          lastUpdated: dataUpdatedAt,
          price: item.sparkline[item.sparkline.length - 1],
        });
      }

      return acc;
    }, []);
  }, [data, symbols]);

  const startFeed = usePriceChanges(priceFeeds);

  useEffect(() => {
    if (ensureAgGrid(gridRef?.current) && tableData?.length) startFeed();
  }, [tableData, gridRef, priceFeeds]);

  const getRowId = useMemo<GetRowIdFunc>(() => {
    return (params: GetRowIdParams) => params?.data?.symbol;
  }, []);

  const onGridReady = useCallback(
    (_params: GridReadyEvent) => startFeed(),
    [startFeed],
  );

  const contextMenuItems = useCallback(
    (params: GetContextMenuItemsParams) =>
      getContextMenuItems(params, { widgetId: widgetUuid }),
    [widgetUuid],
  );

  const { renderRow0Params, renderBelowNavbarRows } = useWidgetParamsPositions();

  return (
    <DraggableCard
      aiEnabled={true}
      aiData={tableData}
      lastUpdated={dataUpdatedAt}
      elementRightNextToTitle={renderRow0Params}
      elementBelowNavbar={renderBelowNavbarRows}
      loading={isLoading}
      error={data?.length === 0 ? "No data found" : error}
    >
      <div className="grid h-[calc(100%-5px)] min-h-[100px]">
        <AgGridProvider
          rowData={tableData}
          getContextMenuItems={contextMenuItems}
          onGridReady={onGridReady}
          getRowId={getRowId}
          columnDefs={pythColumnDefs}
          suppressModelUpdateAfterUpdateTransaction={true}
        />
      </div>
    </DraggableCard>
  );
}

const pythColumnDefs = [
  {
    headerName: "Symbol",
    field: "symbol",
    sortable: true,
    filter: "agTextColumnFilter",
    valueFormatter: (params) => params.value.replace(/\./g, " - "),
  },
  {
    headerName: "Price",
    field: "price",
    filter: "agNumberColumnFilter",
    cellDataType: "number",
    type: "numericColumn",
    valueFormatter: (params: any) => `$${formatPrice(params.value)}`,
    sortable: true,
    enableValue: true,
  },
  {
    headerName: "1H",
    field: "hour_price_diff_decimal",
    sortable: true,
    filter: "agNumberColumnFilter",
    type: "numericColumn",
    cellRenderer: (params) => {
      return formatPercentage(params.value * 100, true);
    },
  },
  {
    headerName: "24H",
    field: "day_price_diff_decimal",
    sortable: true,
    filter: "agNumberColumnFilter",
    type: "numericColumn",
    cellRenderer: (params) => {
      return formatPercentage(params.value * 100, true);
    },
  },
  {
    headerName: "7D",
    field: "week_price_diff_decimal",
    sortable: true,
    filter: "agNumberColumnFilter",
    type: "numericColumn",
    cellRenderer: (params) => {
      return formatPercentage(params.value * 100, true);
    },
  },
  {
    flex: 1,
    headerName: "Last 7 Days",
    field: "sparkline",
    sortable: false,
    filter: false,
    enableValue: true,
    cellRenderer: "agSparklineCellRenderer",
    cellRendererParams: {
      sparklineOptions: {
        type: "line",
        fill: "#e2e8f0",
        stroke: "#3b82f6",
        highlightStyle: {
          fill: "#93c5fd",
        },
      },
    },
  },
];
