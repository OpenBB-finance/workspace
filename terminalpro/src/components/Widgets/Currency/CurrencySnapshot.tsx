import { keepPreviousData } from "@tanstack/react-query";
import type { ColDef, GridOptions } from "ag-grid-community";
import { type ReactElement, useCallback, useMemo, useState } from "react";
import DraggableCard from "~/components/DraggableCard";
import {
  formatTime,
  getContextMenuItems,
  getTimezoneCompact,
} from "~/components/General/Table/AgGridUtils";
import { AgGridProvider, useColumnVisibility } from "~/components/General/Table/hooks";
import TableSettings from "~/components/General/Table/SubMenus/TableSettings";
import Tooltip from "~/components/Tooltip";
import { useWidgetContext } from "~/components/Widget.context";
import {
  useCurrencySnapshots,
  useEquityPricePerformance,
} from "~/lib/api/sdkComponents";
import type { FMPCurrencySnapshotsData } from "~/lib/api/sdkSchemas";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn, formatNumber } from "~/lib/utils";
import DropdownCheckboxItems from "../Helpers/DropdownCheckboxItems";

export function formatPercentage(
  value: string | number,
  withColor = false,
  decimals = 2,
): ReactElement | string {
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return "Invalid value";
  }
  const formattedValue = `${numericValue >= 0 ? "+" : ""}${formatNumber(
    numericValue,
    decimals,
  )}%`;
  if (withColor) {
    return (
      <span
        className={cn({
          "text-green-400": numericValue > 0,
          "text-red-500": numericValue < 0,
        })}
      >
        {formattedValue}
      </span>
    );
  }
  return formattedValue;
}

export default function CurrencySnapshot() {
  const { widget, updateWidget } = useWidgetContext();

  const decimalDigits = useShallowThemeStore((s) => s.decimalDigits);
  const decimalDigitsToUse = widget?.storage?.decimalDigits ?? decimalDigits;

  const [decimalDigitsSettings, setDecimalDigitsSettings] =
    useState(decimalDigitsToUse);

  const allPairs = useMemo(() => {
    const baseCurrencies = widget?.storage?.params?.base || [];
    const quoteCurrencies = widget?.storage?.params?.counter_currencies || [];
    const pairs = baseCurrencies.flatMap((base) =>
      quoteCurrencies.map((quote) => `${base}${quote}`),
    );
    return pairs;
  }, [widget?.storage?.params?.base, widget?.storage?.params?.counter_currencies]);

  const pairsExist = useMemo(
    () => allPairs?.length > 0 && allPairs !== undefined,
    [allPairs],
  );

  const { data: snapshotsQuery, isLoading } = useCurrencySnapshots(
    {
      queryParams: {
        base: widget?.storage?.params?.base?.join(","),
        provider: "fmp",
        counter_currencies: widget?.storage?.params?.counter_currencies?.join(","),
      },
    },
    {
      staleTime: 1000 * 60 * 5,
      enabled: pairsExist,
    },
  ) as { data: { results: FMPCurrencySnapshotsData[] }; isLoading: boolean };

  const currencySnapshots = snapshotsQuery?.results;

  const { data: quoteQuery } = useEquityPricePerformance(
    {
      queryParams: {
        provider: "fmp",
        symbol: allPairs.join(","),
      },
    },
    {
      enabled: pairsExist,
      staleTime: 1000 * 60 * 5,
      placeholderData: keepPreviousData,
    },
  );

  const quoteData = quoteQuery?.results;

  const combinedData = useMemo(() => {
    if (!(currencySnapshots && quoteData)) return [];

    return currencySnapshots.map((snapshot) => {
      const quote = quoteData.find(
        (q) => `${snapshot.base_currency}${snapshot.counter_currency}` === q.symbol,
      );

      return {
        ...snapshot,
        change_percent: snapshot?.change_percent * 100,
        symbol: `${snapshot.base_currency}/${snapshot.counter_currency}`,
        one_day: quote?.one_day * 100,
        one_week: quote?.one_week * 100,
        one_month: quote?.one_month * 100,
        three_month: quote?.three_month * 100,
        six_month: quote?.six_month * 100,
        ytd: quote?.ytd * 100,
        one_year: quote?.one_year * 100,
        three_year: quote?.three_year * 100,
        five_year: quote?.five_year * 100,
        ten_year: quote?.ten_year * 100,
        max: quote?.max * 100,
      };
    });
  }, [currencySnapshots, quoteData]);

  const timezone = getTimezoneCompact();

  const columnDefs = useMemo(() => {
    return [
      { field: "base_currency", rowGroup: true, hide: true },
      {
        headerName: "Symbol",
        flex: 1,
        field: "symbol",
        filter: "agTextColumnFilter",
        cellDataType: "text",
      },
      {
        field: "last_rate",
        headerName: "Last",
        flex: 1,
        filter: "agNumberColumnFilter",
        type: "numericColumn",
        cellRenderer: (params) => {
          return (
            <span className="whitespace-nowrap" title={params.value}>
              {formatNumber(params.value, decimalDigitsToUse)}
            </span>
          );
        },
      },
      {
        field: "open",
        headerName: "Open",
        flex: 1,
        hide: true,
        filter: "agNumberColumnFilter",
        type: "numericColumn",
        cellRenderer: (params) => {
          return (
            <span className="whitespace-nowrap" title={params.value}>
              {formatNumber(params.value, decimalDigitsToUse)}
            </span>
          );
        },
      },
      {
        field: "high",
        headerName: "High",
        flex: 1,
        hide: true,
        filter: "agNumberColumnFilter",
        type: "numericColumn",
        cellRenderer: (params) => {
          return (
            <span className="whitespace-nowrap" title={params.value}>
              {formatNumber(params.value, decimalDigitsToUse)}
            </span>
          );
        },
      },
      {
        field: "low",
        headerName: "Low",
        flex: 1,
        hide: true,
        filter: "agNumberColumnFilter",
        type: "numericColumn",
        cellRenderer: (params) => {
          return (
            <span className="whitespace-nowrap" title={params.value}>
              {formatNumber(params.value, decimalDigitsToUse)}
            </span>
          );
        },
      },
      {
        field: "volume",
        headerName: "Volume",
        flex: 1,
        hide: true,
        filter: "agNumberColumnFilter",
      },
      {
        field: "prev_close",
        headerName: "Prev Close (%)",
        flex: 1,
        type: "numericColumn",
        valueGetter: (params) => {
          if (params.node.group) return "";
          if (!(params.data?.prev_close && params.data?.last_rate)) return 0;
          const prevClose = params.data.prev_close;
          const lastRate = params.data.last_rate;
          return formatNumber(
            ((lastRate - prevClose) / prevClose) * 100,
            decimalDigitsToUse,
          );
        },
        cellRenderer: (params) => {
          if (params.node.group) return "";
          return formatPercentage(params.value, true, decimalDigitsToUse);
        },
      },
      {
        field: "change",
        headerName: "Change",
        flex: 1,
        hide: true,
        filter: "agNumberColumnFilter",
        type: "numericColumn",
        cellRenderer: (params) => {
          return (
            <span className="whitespace-nowrap" title={params.value}>
              {formatNumber(params.value, decimalDigitsToUse)}
            </span>
          );
        },
      },
      {
        field: "change_percent",
        headerName: "Change Percent",
        flex: 1,
        hide: true,
        cellRenderer: (params) => {
          if (params.node.group) return "";
          return formatPercentage(params.value, true, decimalDigitsToUse);
        },
        filter: "agNumberColumnFilter",
      },
      {
        field: "ma50",
        headerName: "MA50",
        flex: 1,
        hide: true,
        filter: "agNumberColumnFilter",
        type: "numericColumn",
        cellRenderer: (params) => {
          return (
            <span className="whitespace-nowrap" title={params.value}>
              {formatNumber(params.value, decimalDigitsToUse)}
            </span>
          );
        },
      },
      {
        field: "ma200",
        headerName: "MA200",
        flex: 1,
        hide: true,
        filter: "agNumberColumnFilter",
        type: "numericColumn",
        cellRenderer: (params) => {
          return (
            <span className="whitespace-nowrap" title={params.value}>
              {formatNumber(params.value, decimalDigitsToUse)}
            </span>
          );
        },
      },
      {
        field: "year_high",
        headerName: "52W High",
        flex: 1,
        filter: "agNumberColumnFilter",
        type: "numericColumn",
        cellRenderer: (params) => {
          return (
            <span className="whitespace-nowrap" title={params.value}>
              {formatNumber(params.value, decimalDigitsToUse)}
            </span>
          );
        },
      },
      {
        field: "year_low",
        headerName: "52W Low",
        flex: 1,
        filter: "agNumberColumnFilter",
        type: "numericColumn",
        cellRenderer: (params) => {
          return (
            <span className="whitespace-nowrap" title={params.value}>
              {formatNumber(params.value, decimalDigitsToUse)}
            </span>
          );
        },
      },
      {
        field: "one_week",
        headerName: "1W%",
        flex: 1,
        filter: "agNumberColumnFilter",
        type: "numericColumn",
        cellRenderer: (params) => {
          if (params.node.group) return "";
          return formatPercentage(params.value, true, decimalDigitsToUse);
        },
      },
      {
        field: "one_month",
        headerName: "1M%",
        flex: 1,
        hide: true,
        filter: "agNumberColumnFilter",
        type: "numericColumn",
        cellRenderer: (params) => {
          if (params.node.group) return "";
          return formatPercentage(params.value, true, decimalDigitsToUse);
        },
      },
      {
        field: "three_month",
        headerName: "3M%",
        flex: 1,
        filter: "agNumberColumnFilter",
        type: "numericColumn",
        cellRenderer: (params) => {
          if (params.node.group) return "";
          return formatPercentage(params.value, true, decimalDigitsToUse);
        },
      },
      {
        field: "six_month",
        headerName: "6M%",
        flex: 1,
        filter: "agNumberColumnFilter",
        type: "numericColumn",
        cellRenderer: (params) => {
          if (params.node.group) return "";
          return formatPercentage(params.value, true, decimalDigitsToUse);
        },
      },
      {
        field: "ytd",
        headerName: "YTD%",
        flex: 1,
        hide: true,
        filter: "agNumberColumnFilter",
        type: "numericColumn",
        cellRenderer: (params) => {
          if (params.node.group) return "";
          return formatPercentage(params.value, true, decimalDigitsToUse);
        },
      },
      {
        field: "one_year",
        headerName: "1Y%",
        flex: 1,
        hide: true,
        filter: "agNumberColumnFilter",
        type: "numericColumn",
        cellRenderer: (params) => {
          if (params.node.group) return "";
          return formatPercentage(params.value, true, decimalDigitsToUse);
        },
      },
      {
        field: "three_year",
        headerName: "3Y%",
        flex: 1,
        hide: true,
        filter: "agNumberColumnFilter",
        type: "numericColumn",
        cellRenderer: (params) => {
          if (params.node.group) return "";
          return formatPercentage(params.value, true, decimalDigitsToUse);
        },
      },
      {
        field: "five_year",
        headerName: "5Y%",
        flex: 1,
        hide: true,
        filter: "agNumberColumnFilter",
        type: "numericColumn",
        cellRenderer: (params) => {
          if (params.node.group) return "";
          return formatPercentage(params.value, true, decimalDigitsToUse);
        },
      },
      {
        field: "ten_year",
        headerName: "10Y%",
        flex: 1,
        hide: true,
        filter: "agNumberColumnFilter",
        type: "numericColumn",
        cellRenderer: (params) => {
          if (params.node.group) return "";
          return formatPercentage(params.value, true, decimalDigitsToUse);
        },
      },
      {
        field: "last_rate_timestamp",
        headerName: "Time",
        flex: 1,
        filter: "agDateColumnFilter",
        cellRenderer: (params) => {
          if (params.node.group) return "";
          return (
            <Tooltip message={timezone}>
              <div>{formatTime(params.value)}</div>
            </Tooltip>
          );
        },
      },
    ] as ColDef[];
  }, [decimalDigitsToUse]);

  const gridOptions = useMemo(() => {
    return {
      rowHeight: 32,
      headerHeight: 32,
      groupDefaultExpanded: -1,
      autoGroupColumnDef: {
        headerName: "Base Currency",
      },
      groupDisplayType: "multipleColumns",
    } as GridOptions<any>;
  }, []);

  const contextMenuItems = useCallback(
    (params) =>
      getContextMenuItems(params, { enableChart: false, widgetId: widget?.id }),
    [],
  );
  const createPairs = useCallback(
    (baseCurrencies: string[], quoteCurrencies: string[]) => {
      const base = Array.from(new Set(baseCurrencies));
      const quote = Array.from(new Set(quoteCurrencies));
      return base.flatMap((baseCurrency) =>
        quote.map((quoteCurrency) => `${baseCurrency}${quoteCurrency}`),
      );
    },
    [],
  );

  const handleSave = useColumnVisibility(decimalDigitsSettings);

  return (
    <DraggableCard
      aiData={combinedData}
      aiEnabled={true}
      loading={isLoading && pairsExist}
      error={!pairsExist}
      errorMessage="Select a base currency and quote currency to view data"
      showActionsSettings={true}
      onSaveSettings={handleSave}
      settingsModalChildren={
        <TableSettings
          decimalDigitsSettings={decimalDigitsSettings}
          setDecimalDigitsSettings={setDecimalDigitsSettings}
        />
      }
      elementNextToTitle={
        <>
          <DropdownCheckboxItems
            items={CURRENCIES.map((currency) => ({
              label: currency,
              value: currency,
            }))}
            triggerLabel="Base Currency"
            onSelect={(value, checked) => {
              const base = widget?.storage?.params?.base ?? [];
              const counterCurrencies =
                widget?.storage?.params?.counter_currencies ?? [];
              updateWidget((prev) => ({
                ...prev,
                storage: {
                  ...prev.storage,
                  params: {
                    ...(prev?.storage?.params ?? {}),
                    base: checked ? [...base, value] : base.filter((c) => c !== value),
                    symbol: createPairs([...base, value], counterCurrencies),
                  },
                },
              }));
            }}
            selected={widget.storage.params.base ?? []}
          />
          <DropdownCheckboxItems
            items={CURRENCIES.map((currency) => ({
              label: currency,
              value: currency,
            }))}
            triggerLabel="Quote Currency"
            onSelect={(value, checked) => {
              const base = widget?.storage?.params?.base ?? [];
              const counterCurrencies =
                widget?.storage?.params?.counter_currencies ?? [];
              updateWidget((prev) => ({
                ...prev,
                storage: {
                  ...prev.storage,
                  params: {
                    ...(prev?.storage?.params ?? {}),
                    counter_currencies: checked
                      ? [...counterCurrencies, value]
                      : counterCurrencies.filter((c) => c !== value),
                    symbol: createPairs(base, [...counterCurrencies, value]),
                  },
                },
              }));
            }}
            selected={widget.storage.params.counter_currencies ?? []}
          />
        </>
      }
    >
      {pairsExist && widget?.storage?.params?.base?.length > 0 && (
        <div className="grid h-[calc(100%-5px)] min-h-[100px]">
          <AgGridProvider
            gridOptions={gridOptions}
            enableCharts={false}
            rowData={combinedData}
            columnDefs={columnDefs}
            getContextMenuItems={contextMenuItems}
          />
        </div>
      )}
    </DraggableCard>
  );
}

export const CURRENCIES = [
  "USD",
  "EUR",
  "JPY",
  "GBP",
  "AUD",
  "CAD",
  "CHF",
  "CNY",
  "XAU",
  "XAG",
  "AED",
  "ARS",
  "BRL",
  "CLP",
  "CZK",
  "DKK",
  "EGP",
  "HKD",
  "HUF",
  "IDR",
  "ILS",
  "INR",
  "ISK",
  "KES",
  "KRW",
  "KZT",
  "LBP",
  "MXN",
  "MYR",
  "NGN",
  "NOK",
  "NZD",
  "PLN",
  "QAR",
  "RON",
  "RUB",
  "SAR",
  "SEK",
  "SGD",
  "THB",
  "TRY",
  "TWD",
  "ZAR",
];

export const CURRENCY_EMOJIS = {
  EUR: "🇪🇺",
  USD: "🇺🇸",
  GBP: "🇬🇧",
  JPY: "🇯🇵",
  AUD: "🇦🇺",
  CAD: "🇨🇦",
  CHF: "🇨🇭",
  CNY: "🇨🇳",
  NZD: "🇳🇿",
};
