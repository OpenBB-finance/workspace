import type { Ticker } from "~/components/types";
import type { FMPFinancialRatiosData, FMPKeyMetricsData } from "~/lib/api/sdkSchemas";
import type { COMPARISON_TYPES, FINANCIAL_RATIOS } from "./constants";

type IgnoreFields = "name" | "symbol" | "period_ending" | "fiscal_period";

export type FinancialRatio = Omit<FMPFinancialRatiosData, IgnoreFields> & {
  name?: string;
  symbol?: string;
  period_ending?: string;
  fiscal_period?: string;
};

export type KeyMetric = Omit<FMPKeyMetricsData, IgnoreFields> & {
  name?: string;
  symbol?: string;
  period_ending?: string;
  fiscal_period?: string;
};

export type SelectedGroup = (typeof COMPARISON_TYPES)[number]["value"];
export type SelectedRatio = (typeof FINANCIAL_RATIOS)[number]["value"];

export type Selected = {
  interval: "annual" | "quarter";
  quarter: "FY" | "Q1" | "Q2" | "Q3" | "Q4" | "TTM";
  year: number;
  group: SelectedGroup;
  ratio: SelectedRatio;
};

export type PeersState = {
  additionalPeers: string[];
  availableTickers: Ticker[];
};
