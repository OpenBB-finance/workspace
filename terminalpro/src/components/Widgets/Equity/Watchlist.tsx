import { keepPreviousData } from "@tanstack/react-query";
import type { ColDef, GetContextMenuItemsParams } from "ag-grid-community";
import type { CustomCellRendererProps } from "ag-grid-react";
import clsx from "clsx";
import { usePostHog } from "posthog-js/react";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import DecimalDigitsRadio from "~/components/DecimalDigitsRadio";
import DraggableCard from "~/components/DraggableCard";
import Avatar from "~/components/General/Avatar";
import { getContextMenuItems } from "~/components/General/Table/AgGridUtils";
import {
  AgGridProvider,
  ensureAgGrid,
  useAgExportFuncs,
  useAgGridContext,
  useQuickActionsSettings,
} from "~/components/General/Table/hooks";
import { useCopilotFilteredWidgetData } from "~/components/General/Table/hooks/useCopilotFilteredData";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import { useWidgetContext } from "~/components/Widget.context";
import { useStateReducer } from "~/hooks/useStateReducer";
import { useProWatchlist } from "~/lib/api/sdkComponents";
import { type Ticker, useShallowAppStore } from "~/lib/state/app";
import { useShallowThemeStore } from "~/lib/state/theme";
import { formatNumber, getJsonWidget, uuidv4 } from "~/lib/utils";
import { changeStep } from "~/lib/utils/tutorial";
import AdvancedSelectedTickers from "../Helpers/AdvancedSelectedTickers";
import GroupDropdown from "../Helpers/GroupDropdown";

type CellRendererProps = CustomCellRendererProps & {
  decimalDigitsToUse?: number;
  percentChange?: boolean;
};

function useOnRowClicked(quoteQuery: Omit<ReturnType<typeof useProWatchlist>, "data">) {
  const { widget: { data: { mainTicker, secondaryTickers } = {} } = {}, updateWidget } =
    useWidgetContext();
  const gridRef = useAgGridContext()?.gridRef;

  const localMainTickerRef = useRef<Ticker>(mainTicker);

  const onRowClicked = useCallback(
    (params) => {
      const newTicker = params.data.symbol;
      if (newTicker && newTicker !== mainTicker.symbol) {
        changeStep("group_sector_companies", 3);
        const ticker =
          secondaryTickers?.find((t) => t.symbol === params.data.symbol) ??
          ({
            symbol: params.data.symbol,
            id: params.data.symbol,
            category: "equity",
            type: "stock",
          } as Ticker);

        updateWidget((prev) => ({
          ...prev,
          data: {
            ...prev.data,
            mainTicker: ticker,
          },
        }));
      }
    },
    [mainTicker, secondaryTickers, updateWidget],
  );

  useEffect(() => {
    localMainTickerRef.current = mainTicker;
  }, [mainTicker]);

  const rowClassRules = useMemo(() => {
    return {
      "ca-row-selected": (params) =>
        params.data?.symbol === localMainTickerRef?.current?.symbol,
    };
  }, [localMainTickerRef]);

  useLayoutEffect(() => {
    setTimeout(() => {
      if (ensureAgGrid(gridRef?.current)) {
        gridRef.current.api.updateGridOptions({
          onRowClicked,
          rowClassRules: rowClassRules,
        });
      }
    });
  }, [gridRef?.current, onRowClicked, quoteQuery.dataUpdatedAt, quoteQuery.isSuccess]);
}

function useWatchlistData() {
  const {
    widget: {
      data: { mainTicker, secondaryTickers } = {},
      storage: { decimalDigits: storageDigits } = {},
    } = {},
  } = useWidgetContext();

  const decimalDigits = useShallowThemeStore((s) => s.decimalDigits);
  const decimalDigitsToUse = storageDigits ?? decimalDigits;

  const [state, dispatch] = useStateReducer({
    decimalDigitsSettings: decimalDigitsToUse as number,
    localMainTicker: mainTicker,
  });

  const { data, ...quoteQuery } = useProWatchlist(
    {
      queryParams: {
        data_provider: "fmp",
        symbol: secondaryTickers?.map((t) => t.symbol).join(","),
      },
    },
    {
      enabled: secondaryTickers?.length > 0,
      placeholderData: keepPreviousData,
      staleTime: 1000 * 60 * 5,
    },
  );

  const metrics = data?.results;

  useOnRowClicked(quoteQuery);

  const colDefs = useMemo(() => {
    return [
      {
        pinned: "left",
        field: "symbol",
        headerName: "Name",
        minWidth: 200,
        cellRenderer: (params) => {
          return (
            <span className="flex items-center gap-2 text-xs">
              <Avatar
                src={`https://images.openbb.co/logos/${params.value}`}
                alt={params.value}
                size={24}
                extraClassName="shrink-0"
              />
              <span className="flex flex-col gap-px">
                <span className="text-left font-bold uppercase">{params.value}</span>
                <span>{params?.data?.name}</span>
              </span>
            </span>
          );
        },
      },
      {
        field: "last_quote",
        headerName: "Last",
        filter: "agNumberColumnFilter",
        type: "numericColumn",
        minWidth: 80,
        cellRenderer: NumberCellRenderer,
        cellRendererParams: { decimalDigitsToUse },
      },
      {
        field: "day_change_percent",
        headerName: "Day Change",
        filter: "agNumberColumnFilter",
        type: "numericColumn",
        minWidth: 120,
        cellRenderer: NumberCellRenderer,
        cellRendererParams: { decimalDigitsToUse, percentChange: true },
      },
      {
        field: "week_change",
        headerName: "Week Change",
        filter: "agNumberColumnFilter",
        type: "numericColumn",
        minWidth: 120,
        valueFormatter: (params) => {
          return params.value ?? "-";
        },
        cellRenderer: NumberCellRenderer,
        cellRendererParams: { decimalDigitsToUse, percentChange: true },
      },
      {
        field: "month_change",
        headerName: "Month Change",
        filter: "agNumberColumnFilter",
        type: "numericColumn",
        minWidth: 120,
        valueFormatter: (params) => {
          return params.value ?? "-";
        },
        cellRenderer: NumberCellRenderer,
        cellRendererParams: { decimalDigitsToUse, percentChange: true },
      },
      {
        field: "year_change",
        headerName: "Year Change",
        filter: "agNumberColumnFilter",
        type: "numericColumn",
        minWidth: 120,
        valueFormatter: (params) => {
          return params.value ?? "-";
        },
        cellRenderer: NumberCellRenderer,
        cellRendererParams: { decimalDigitsToUse, percentChange: true },
      },
      {
        field: "pe",
        headerName: "P/E Ratio",
        filter: "agNumberColumnFilter",
        minWidth: 95,
        type: "numericColumn",
        cellRenderer: NumberCellRenderer,
        cellRendererParams: { decimalDigitsToUse },
      },
      {
        field: "market_cap",
        headerName: "Market Cap",
        filter: "agNumberColumnFilter",
        minWidth: 120,
        type: "numericColumn",
        cellRenderer: MarketCapCellRenderer,
        cellRendererParams: { decimalDigitsToUse },
      },
      {
        field: "day_volume",
        headerName: "Day Volume",
        filter: "agNumberColumnFilter",
        minWidth: 120,
        type: "numericColumn",
        cellRenderer: NumberCellRenderer,
        cellRendererParams: { decimalDigitsToUse },
      },
    ].map((column) => {
      // @ts-expect-error
      if (!column?.filterParams) {
        // @ts-expect-error
        column.filterParams = {
          buttons: ["apply", "clear"],
          closeOnApply: true,
        };
      }
      return column;
    }) as ColDef[];
  }, [decimalDigitsToUse]);

  useCopilotFilteredWidgetData(metrics, quoteQuery.dataUpdatedAt);

  return {
    metrics,
    dispatch,
    decimalDigitsSettings: state.decimalDigitsSettings,
    quoteQuery,
    colDefs,
  };
}

export function Watchlist() {
  const { widgetRef, updateWidget } = useWidgetContext();
  const posthog = usePostHog();

  const { metrics, colDefs, dispatch, quoteQuery, ...rest } = useWatchlistData();

  const quickActions = useQuickActionsSettings();
  const exportFns = useAgExportFuncs();

  const contextMenuItems = useCallback(
    (params: GetContextMenuItemsParams) => {
      const menuItems = getContextMenuItems(params, {
        widgetId: widgetRef.current?.id,
        enableChart: false,
      });

      if (params?.column?.getColId() === "symbol" && params?.value) {
        menuItems.splice(8, 0, {
          name: `Remove ${params.value} from watchlist`,
          icon: '<span class="ag-icon ag-icon-cross" unselectable="on" role="presentation"/>',
          action: () => {
            const tickerToRemove = params.value;
            updateWidget((prev) => {
              const newTickers = prev.data.secondaryTickers.filter(
                (t) => t.symbol !== tickerToRemove,
              );

              const mainTicker = newTickers?.find(
                (t) => t?.symbol === prev.data.mainTicker?.symbol,
              ); // check if main ticker is in the list

              return {
                ...prev,
                data: {
                  ...prev.data,
                  secondaryTickers: newTickers,
                  mainTicker: mainTicker ?? newTickers?.[0],
                },
                storage: {
                  ...(prev.storage ?? {}),
                  params: {
                    ...(prev.storage?.params ?? {}),
                    symbol: newTickers.map((t) => t.symbol).join(","),
                  },
                },
              };
            });
          },
        });
      }
      return menuItems;
    },
    [widgetRef, updateWidget],
  );

  const extraNavbarElements = useMemo(() => <WatchlistToCharting />, []);
  const elementRightNextToTitle = useMemo(
    () => (
      <GroupDropdown type="ticker">
        <AdvancedSelectedTickers
          className="pr-1"
          ignoreMainTicker={true}
          triggerInside={
            <>
              <Icon id="pencil-icon" className="h-2.5 w-2.5" />
              <span className="whitespace-nowrap text-xs">Edit Tickers</span>
            </>
          }
          setTickers={(tickers, _mainTicker) => {
            tickers = Object.values(
              Object.fromEntries(tickers.map((t) => [t.symbol, t])),
            );

            // check if main ticker is in the list
            const mainTicker = tickers?.find((t) => t?.symbol === _mainTicker?.symbol);

            updateWidget((prev) => ({
              ...prev,
              data: {
                ...prev.data,
                // if not, set the first ticker as main ticker
                mainTicker: mainTicker ?? tickers?.[0],
                secondaryTickers: tickers,
              },
              storage: {
                ...(prev.storage ?? {}),
                params: {
                  ...(prev.storage?.params ?? {}),
                  symbol: tickers.map((t) => t.symbol).join(","),
                },
              },
            }));
            if (posthog) {
              posthog.capture("added_ticker_to_watchlist", {
                secondaryTickersLength: tickers.length,
                secondaryTickers: tickers.map((ticker) => ticker.symbol),
                widget_id: widgetRef.current?.id,
              });
            }
          }}
          triggerSize="sm"
        />
      </GroupDropdown>
    ),
    [posthog, updateWidget],
  );

  const onSaveSettings = useCallback(() => {
    updateWidget((prev) => ({
      ...prev,
      storage: {
        ...prev.storage,
        decimalDigits: rest.decimalDigitsSettings,
      },
    }));
  }, [rest.decimalDigitsSettings, updateWidget]);

  return (
    <DraggableCard
      aiEnabled={true}
      aiData={true}
      lastUpdated={quoteQuery.dataUpdatedAt}
      loading={quoteQuery.isLoading && !metrics}
      error={quoteQuery.error}
      showActionsSettings={true}
      onSaveSettings={onSaveSettings}
      settingsModalChildren={
        <DecimalDigitsRadio
          decimalDigits={rest.decimalDigitsSettings}
          setDecimalDigits={(decimalDigits) =>
            dispatch({ decimalDigitsSettings: decimalDigits })
          }
        />
      }
      extraClassName="overflow-hidden"
      exportFns={exportFns}
      elementRightNextToTitle={elementRightNextToTitle}
      /* Set 3 */
      extraNavbarElements={extraNavbarElements}
      extraSettings={[quickActions]}
    >
      <div className="grid h-[calc(100%-5px)] min-h-[190px]">
        <AgGridProvider
          rowData={metrics}
          columnDefs={colDefs}
          getContextMenuItems={contextMenuItems}
          rowHeight={36}
        />
      </div>
    </DraggableCard>
  );
}

function WatchlistToCharting() {
  const {
    widget: { data: { mainTicker, secondaryTickers } = {} } = {},
    activeDashboardId,
  } = useWidgetContext();
  const addWidget = useShallowAppStore((s) => s.addWidget);

  const createWidget = useCallback(() => {
    const newMainTicker = mainTicker ?? secondaryTickers?.[0];
    const widget = {
      ...getJsonWidget("charting"),
      id: uuidv4(),
      data: {
        mainTicker: newMainTicker,
        secondaryTickers: secondaryTickers.filter(
          (t) => t.symbol !== newMainTicker?.symbol,
        ),
      },
    };
    addWidget(activeDashboardId, widget);
  }, [addWidget, activeDashboardId, mainTicker, secondaryTickers]);

  return (
    <Tooltip message="See watchlist in charting">
      <div
        className="rounded-[2px] p-0.5 dark:active:bg-light-70 hover:bg-light-50 active:bg-light-100 dark:hover:bg-[#2A2A31]"
        onClick={createWidget}
      >
        <Icon id="chart-icon" className="w-3.5 h-3.5" />
      </div>
    </Tooltip>
  );
}

function NumberCellRenderer(params: CellRendererProps) {
  const percentChange = params?.percentChange;
  return (
    <span
      className={clsx(
        "whitespace-nowrap",
        percentChange && {
          "text-green-500": params.value > 0,
          "text-red-500": params.value < 0,
          "text-light-500 dark:text-light-400": params.value === 0,
        },
      )}
      title={params.value}
    >
      {formatNumber(params.value, params?.decimalDigitsToUse)}
      {percentChange && (params.value ? "%" : "")}
    </span>
  );
}

function MarketCapCellRenderer(params: CellRendererProps) {
  const secondaryTickers = useWidgetContext()?.widget?.data?.secondaryTickers ?? [];
  const currency = secondaryTickers?.find(
    (t) => t.symbol === params.data.symbol,
  )?.currency;

  return (
    <span className="whitespace-nowrap" title={params.value}>
      {formatNumber(params.value, params?.decimalDigitsToUse)}{" "}
      <span className="text-xs text-light-500">{currency}</span>
    </span>
  );
}

export default memo(Watchlist);
