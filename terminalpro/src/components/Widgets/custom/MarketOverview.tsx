import { useMemo } from "react";
import DraggableCard from "~/components/DraggableCard";
import { useWidgetParamsPositions } from "~/components/General/Table/NavBar/QueryParams";
import { useWidgetContext } from "~/components/Widget.context";
import { useJsonData } from "~/lib/api";
import TopMarketOverviewItem from "../../Charting/TopMarketOverviewItem";

export interface HistoricalDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface MarketData {
  // Basic market information
  symbol: string;
  name?: string;
  assetType?: "crypto" | "stock" | "index" | "forex" | string;

  // Current price data
  lastPrice: number;
  prevClose: number;
  change: number;
  changePercent: number;

  // Historical data for the chart
  historicalData: HistoricalDataPoint[];

  // Pattern matching for day separation
  prevDayPattern: string; // Regex pattern for previous day
  currentDayPattern: string; // Regex pattern for current day

  // Additional metadata
  lastUpdated?: string;
  tradingHours?: {
    start: string;
    end: string;
    timezone: string;
  };
  is24h?: boolean; // For crypto markets
}

export default function MarketOverview() {
  const { widget } = useWidgetContext();
  const options = useMemo(() => {
    const newParams = Object.fromEntries(
      Object.entries({
        ...(widget?.endpoint?.query ?? {}),
        ...(widget?.storage?.params ?? {}),
      }).filter(([_key, value]) => value !== "" && value !== undefined),
    );

    return {
      url: widget.endpoint?.url,
      endpointHeaders: widget.endpoint?.headers ?? {},
      method: widget.endpoint?.method ?? "GET",
      params: newParams,
    };
  }, [widget?.endpoint, widget?.storage?.params]);

  const { data, isLoading, error, dataUpdatedAt } = useJsonData<MarketData[]>(options, {
    enabled: !!widget?.endpoint?.url,
    staleTime: widget?.staleTime ?? 1000 * 60 * 15,
  });

  const memoizedMarketItems = useMemo(() => {
    if (!data?.length) return null;

    return data.map((market) => (
      <TopMarketOverviewItem
        key={market.symbol}
        market={{
          id: market.symbol,
          symbol: market.symbol,
          name: market.name || market.symbol,
          type: market.assetType || "unknown",
        }}
        quote={{
          symbol: market.symbol,
          last_price: market.lastPrice,
          prev_close: market.prevClose,
          change: market.change,
          change_percent: market.changePercent,
        }}
        data={market.historicalData}
        dataUpdatedAt={dataUpdatedAt}
        regexs={{
          prevDay: new RegExp(market.prevDayPattern),
          currentDay: new RegExp(market.currentDayPattern),
        }}
      />
    ));
  }, [data, dataUpdatedAt]);

  const { renderRow0Params, renderBelowNavbarRows } = useWidgetParamsPositions();

  return (
    <DraggableCard
      elementRightNextToTitle={renderRow0Params}
      elementBelowNavbar={renderBelowNavbarRows}
      lastUpdated={dataUpdatedAt}
      loading={isLoading}
      error={error || !data}
      errorMessage={widget?.external ? error?.message : "No results found"}
    >
      <div className="flex flex-wrap gap-4">{memoizedMarketItems}</div>
    </DraggableCard>
  );
}

const MOCK_DATA: MarketData[] = [
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    assetType: "stock",
    lastPrice: 173.5,
    prevClose: 172.25,
    change: 1.25,
    changePercent: 0.0073,
    historicalData: [
      {
        date: "2025-04-10T09:30:00-04:00",
        open: 172.26,
        high: 173.1,
        low: 171.36,
        close: 171.76,
      },
      {
        date: "2025-04-10T09:45:00-04:00",
        open: 171.79,
        high: 172.96,
        low: 171.18,
        close: 171.18,
      },
      {
        date: "2025-04-10T10:00:00-04:00",
        open: 171.16,
        high: 171.52,
        low: 170.3,
        close: 170.73,
      },
      {
        date: "2025-04-10T10:15:00-04:00",
        open: 170.75,
        high: 171.92,
        low: 170.55,
        close: 171.1,
      },
      {
        date: "2025-04-10T10:30:00-04:00",
        open: 171.12,
        high: 172.47,
        low: 171.12,
        close: 171.75,
      },
      {
        date: "2025-04-10T10:45:00-04:00",
        open: 171.75,
        high: 171.84,
        low: 170.35,
        close: 170.44,
      },
      {
        date: "2025-04-10T11:00:00-04:00",
        open: 170.42,
        high: 171.28,
        low: 170.26,
        close: 170.44,
      },
      {
        date: "2025-04-10T11:15:00-04:00",
        open: 170.45,
        high: 170.51,
        low: 169.26,
        close: 169.26,
      },
      {
        date: "2025-04-10T11:30:00-04:00",
        open: 169.26,
        high: 169.45,
        low: 168.55,
        close: 168.65,
      },
      {
        date: "2025-04-10T11:45:00-04:00",
        open: 168.61,
        high: 168.94,
        low: 167.24,
        close: 167.41,
      },
      {
        date: "2025-04-10T12:00:00-04:00",
        open: 167.4,
        high: 167.87,
        low: 166.3,
        close: 166.44,
      },
      {
        date: "2025-04-10T12:15:00-04:00",
        open: 166.41,
        high: 166.41,
        low: 165.94,
        close: 166.75,
      },
      {
        date: "2025-04-10T12:30:00-04:00",
        open: 166.76,
        high: 168.07,
        low: 166.7,
        close: 168.07,
      },
      {
        date: "2025-04-10T12:45:00-04:00",
        open: 168.05,
        high: 169.85,
        low: 168.09,
        close: 169.71,
      },
      {
        date: "2025-04-10T13:00:00-04:00",
        open: 169.7,
        high: 170.41,
        low: 168.57,
        close: 168.77,
      },
      {
        date: "2025-04-10T13:15:00-04:00",
        open: 168.82,
        high: 169.5,
        low: 168.09,
        close: 169.44,
      },
      {
        date: "2025-04-10T13:30:00-04:00",
        open: 169.42,
        high: 170.58,
        low: 169.16,
        close: 170.57,
      },
      {
        date: "2025-04-10T13:45:00-04:00",
        open: 170.56,
        high: 171.63,
        low: 170.12,
        close: 171.23,
      },
      {
        date: "2025-04-10T14:00:00-04:00",
        open: 171.23,
        high: 172.46,
        low: 170.89,
        close: 170.95,
      },
      {
        date: "2025-04-10T14:15:00-04:00",
        open: 170.95,
        high: 172.81,
        low: 170.73,
        close: 172.68,
      },
      {
        date: "2025-04-10T14:30:00-04:00",
        open: 172.72,
        high: 173.19,
        low: 171.79,
        close: 173.12,
      },
      {
        date: "2025-04-10T14:45:00-04:00",
        open: 173.12,
        high: 173.12,
        low: 171.1,
        close: 172.03,
      },
      {
        date: "2025-04-10T15:00:00-04:00",
        open: 172.02,
        high: 173.08,
        low: 171.03,
        close: 171.43,
      },
      {
        date: "2025-04-10T15:15:00-04:00",
        open: 171.43,
        high: 172.56,
        low: 170.51,
        close: 170.52,
      },
      {
        date: "2025-04-10T15:30:00-04:00",
        open: 170.51,
        high: 171.58,
        low: 169.08,
        close: 169.19,
      },
      {
        date: "2025-04-10T15:45:00-04:00",
        open: 169.21,
        high: 172.06,
        low: 169.05,
        close: 171.44,
      },
      {
        date: "2025-04-11T09:30:00-04:00",
        open: 171.1,
        high: 172.18,
        low: 170.27,
        close: 172.0,
      },
      {
        date: "2025-04-11T09:45:00-04:00",
        open: 172.01,
        high: 172.99,
        low: 171.95,
        close: 172.33,
      },
      {
        date: "2025-04-11T10:00:00-04:00",
        open: 172.01,
        high: 172.69,
        low: 171.1,
        close: 171.89,
      },
      {
        date: "2025-04-11T10:15:00-04:00",
        open: 171.93,
        high: 172.34,
        low: 169.61,
        close: 169.72,
      },
      {
        date: "2025-04-11T10:30:00-04:00",
        open: 169.66,
        high: 171.6,
        low: 169.6,
        close: 171.59,
      },
      {
        date: "2025-04-11T10:45:00-04:00",
        open: 171.69,
        high: 171.96,
        low: 170.84,
        close: 170.86,
      },
      {
        date: "2025-04-11T11:00:00-04:00",
        open: 170.92,
        high: 171.28,
        low: 170.27,
        close: 170.34,
      },
      {
        date: "2025-04-11T11:15:00-04:00",
        open: 170.2,
        high: 170.9,
        low: 169.99,
        close: 170.82,
      },
      {
        date: "2025-04-11T11:30:00-04:00",
        open: 170.74,
        high: 171.94,
        low: 170.62,
        close: 171.72,
      },
      {
        date: "2025-04-11T11:45:00-04:00",
        open: 171.79,
        high: 172.27,
        low: 171.6,
        close: 172.21,
      },
      {
        date: "2025-04-11T12:00:00-04:00",
        open: 172.27,
        high: 172.9,
        low: 172.02,
        close: 172.59,
      },
      {
        date: "2025-04-11T12:15:00-04:00",
        open: 172.59,
        high: 172.82,
        low: 172.03,
        close: 172.3,
      },
      {
        date: "2025-04-11T12:30:00-04:00",
        open: 172.33,
        high: 173.99,
        low: 172.33,
        close: 173.99,
      },
    ],
    prevDayPattern: "2025-04-10",
    currentDayPattern: "2025-04-11",
    lastUpdated: "2025-04-11T16:30:00.000Z",
    tradingHours: {
      start: "09:30",
      end: "16:00",
      timezone: "America/New_York",
    },
    is24h: false,
  },
  {
    symbol: "BTC-USD",
    name: "Bitcoin",
    assetType: "crypto",
    lastPrice: 67250.0,
    prevClose: 66800.0,
    change: 450.0,
    changePercent: 0.0067,
    historicalData: [
      {
        date: "2025-04-10T14:00:00-04:00",
        open: 66400.0,
        high: 66450.0,
        low: 66350.0,
        close: 66420.0,
      },
      {
        date: "2025-04-10T15:00:00-04:00",
        open: 66420.0,
        high: 66500.0,
        low: 66400.0,
        close: 66480.0,
      },
      {
        date: "2025-04-10T16:00:00-04:00",
        open: 66480.0,
        high: 66550.0,
        low: 66450.0,
        close: 66520.0,
      },
      {
        date: "2025-04-10T17:00:00-04:00",
        open: 66520.0,
        high: 66600.0,
        low: 66500.0,
        close: 66580.0,
      },
      {
        date: "2025-04-10T18:00:00-04:00",
        open: 66580.0,
        high: 66650.0,
        low: 66550.0,
        close: 66620.0,
      },
      {
        date: "2025-04-10T19:00:00-04:00",
        open: 66620.0,
        high: 66700.0,
        low: 66600.0,
        close: 66680.0,
      },
      {
        date: "2025-04-10T20:00:00-04:00",
        open: 66680.0,
        high: 66800.0,
        low: 66650.0,
        close: 66750.0,
      },
      {
        date: "2025-04-10T21:00:00-04:00",
        open: 66750.0,
        high: 66850.0,
        low: 66700.0,
        close: 66800.0,
      },
      {
        date: "2025-04-10T22:00:00-04:00",
        open: 66800.0,
        high: 66900.0,
        low: 66750.0,
        close: 66850.0,
      },
      {
        date: "2025-04-10T23:00:00-04:00",
        open: 66850.0,
        high: 66950.0,
        low: 66800.0,
        close: 66900.0,
      },
      {
        date: "2025-04-11T00:00:00-04:00",
        open: 66900.0,
        high: 67000.0,
        low: 66850.0,
        close: 66950.0,
      },
      {
        date: "2025-04-11T01:00:00-04:00",
        open: 66950.0,
        high: 67050.0,
        low: 66900.0,
        close: 67000.0,
      },
      {
        date: "2025-04-11T02:00:00-04:00",
        open: 67000.0,
        high: 67100.0,
        low: 66950.0,
        close: 67050.0,
      },
      {
        date: "2025-04-11T03:00:00-04:00",
        open: 67050.0,
        high: 67150.0,
        low: 67000.0,
        close: 67100.0,
      },
      {
        date: "2025-04-11T04:00:00-04:00",
        open: 67100.0,
        high: 67200.0,
        low: 67050.0,
        close: 67150.0,
      },
      {
        date: "2025-04-11T05:00:00-04:00",
        open: 67150.0,
        high: 67250.0,
        low: 67100.0,
        close: 67200.0,
      },
      {
        date: "2025-04-11T06:00:00-04:00",
        open: 67200.0,
        high: 67300.0,
        low: 67150.0,
        close: 67250.0,
      },
      {
        date: "2025-04-11T07:00:00-04:00",
        open: 67250.0,
        high: 67350.0,
        low: 67200.0,
        close: 67300.0,
      },
      {
        date: "2025-04-11T08:00:00-04:00",
        open: 67300.0,
        high: 67400.0,
        low: 67250.0,
        close: 67350.0,
      },
      {
        date: "2025-04-11T09:00:00-04:00",
        open: 67350.0,
        high: 67450.0,
        low: 67300.0,
        close: 67400.0,
      },
      {
        date: "2025-04-11T10:00:00-04:00",
        open: 67400.0,
        high: 67500.0,
        low: 67350.0,
        close: 67450.0,
      },
      {
        date: "2025-04-11T11:00:00-04:00",
        open: 67450.0,
        high: 67550.0,
        low: 67400.0,
        close: 67500.0,
      },
      {
        date: "2025-04-11T12:00:00-04:00",
        open: 67500.0,
        high: 67600.0,
        low: 67450.0,
        close: 67550.0,
      },
    ],
    prevDayPattern: "2025-04-10",
    currentDayPattern: "2025-04-11",
    lastUpdated: "2025-04-11T12:00:00.000Z",
    is24h: true,
  },
];
