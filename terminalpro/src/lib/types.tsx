import type { NewWidgetT } from "~/components/types";
import type { Ticker } from "./state/app";

export const DEFAULT_TICKERS = {
  AAPL: {
    id: "AAPL",
    symbol: "AAPL",
    name: "Apple Inc.",
    exchange: "NASDAQ",
    exchange_name: "NASDAQ Global Select",
    category: "equity",
    type: "stock",
    currency: "USD",
    country: "US",
    industry: "Consumer - Electronics",
    sector: "Technology",
    cik: "0000320193",
    cusip: "037833100",
    isin: "US0378331005",
    has_options: true,
  },
  MSFT: {
    id: "MSFT",
    symbol: "MSFT",
    name: "Microsoft Corporation",
    exchange: "NASDAQ",
    exchange_name: "NASDAQ Global Select",
    category: "equity",
    type: "stock",
    currency: "USD",
    country: "US",
    industry: "Software - Infrastructure",
    sector: "Technology",
    cik: "0000789019",
    cusip: "594918104",
    isin: "US5949181045",
    has_options: true,
  },
  NVDA: {
    id: "NVDA",
    symbol: "NVDA",
    name: "NVIDIA Corporation",
    exchange: "NASDAQ",
    exchange_name: "NASDAQ Global Select",
    category: "equity",
    type: "stock",
    currency: "USD",
    country: "US",
    industry: "Semiconductors",
    sector: "Technology",
    cik: "0001045810",
    cusip: "67066G104",
    isin: "US67066G1040",
    has_options: true,
  },
  SPY: {
    symbol: "SPY",
    name: "SPDR S&P 500 ETF Trust",
    id: "SPY",
    category: "etf",
    exchange: "AMEX",
    type: "etf",
    exchange_name: "New York Stock Exchange Arca",
    currency: "USD",
    country: "US",
    industry: "",
    sector: "Miscellaneous",
    cik: "0000884394",
    cusip: "78462F103",
    isin: "US78462F1030",
    has_options: true,
  },
  UnitedStates: {
    symbol: "US",
    name: "United States",
    id: "US",
    category: "country",
    exchange: "country",
    type: "country",
    currency: "country",
    country: "country",
    industry: "country",
    sector: "country",
    cik: "country",
    cusip: "country",
    isin: "country",
  },
} as Record<"AAPL" | "MSFT" | "NVDA" | "SPY" | "UnitedStates", Ticker>;

export interface SaveWidgetsPayload {
  saveWidgets: boolean;
}

export type SaveWidgetsEventT = CustomEvent<SaveWidgetsPayload>;
export interface SaveWidgetsEvent extends Event {
  detail: SaveWidgetsPayload;
}

export interface UpdateWidgetPayload {
  newWidget: NewWidgetT;
}

export type UpdateWidgetEventT = CustomEvent<UpdateWidgetPayload>;

export interface UpdateWidgetEvent extends Event {
  detail: UpdateWidgetPayload;
}
