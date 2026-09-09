import type { WidgetJsonT, WidgetT } from "~/components/types";
import type { WidgetId } from "~/components/Widgets";
import WIDGETS from "~/lib/widgets.json";
import { type DataBundle, useFeatureFlagsStore } from "./state/featureFlags";

type WidgetState = {
  paramOrder?: string[];
  params?: Record<string, any>;
  chartView?: WidgetT["storage"]["chartView"];
  chartModel?: WidgetT["storage"]["chartModel"];
  columnState?: WidgetT["data"]["table"]["columnState"];
  filterModel?: Record<string, any>;
  storage?: { text?: string; html?: string };
};

export type TabLayout<Extra = {}> = {
  i: WidgetId;
  x: number;
  y: number;
  w: number;
  h: number;
  state?: WidgetState;
} & Extra;

export const TEMPLATES = {
  charting: {
    img: "/assets/images/templates/charting-light.png",
    darkImg: "/assets/images/templates/charting.png",
    name: "Charting",
    allowCustomization: true,
    tabs: {
      overview: {
        id: "overview",
        name: "Overview",
        layout: [
          {
            i: WIDGETS.charting.widgetId,
            x: 0,
            y: 0,
            w: 40,
            h: 30,
          },
        ],
      },
    },
    widgets: [WIDGETS.charting] as Partial<WidgetJsonT>[],
  },
  equity: {
    img: "/assets/images/openbb_cover.png",
    darkImg: "/assets/images/openbb_cover.png",
    name: "Sandbox App (FMP Data)",
    allowCustomization: false,
    tabs: {
      overview: {
        id: "overview",
        name: "Overview",
        layout: [
          { i: WIDGETS.navigation_bar.widgetId, x: 0, y: 0, w: 40, h: 2, static: true },
          { i: WIDGETS.ticker_information.widgetId, x: 0, y: 2, w: 20, h: 5 },
          { i: WIDGETS.company_profile.widgetId, x: 0, y: 6, w: 20, h: 15 },
          { i: WIDGETS.price_performance.widgetId, x: 20, y: 2, w: 20, h: 20 },
          { i: WIDGETS.key_metrics.widgetId, x: 20, y: 22, w: 10, h: 8 },
          { i: WIDGETS.share_statistics.widgetId, x: 30, y: 22, w: 10, h: 8 },
          { i: WIDGETS.management_team.widgetId, x: 20, y: 30, w: 20, h: 8 },
          {
            i: WIDGETS.revenue_per_geography.widgetId,
            x: 0,
            y: 38,
            w: 20,
            h: 12,
          },
          {
            i: WIDGETS.revenue_per_bus_line.widgetId,
            x: 20,
            y: 38,
            w: 20,
            h: 12,
          },
          { i: WIDGETS.valuation_multiples.widgetId, x: 0, y: 38, w: 20, h: 16 },
        ],
      },
      financials: {
        id: "financials",
        name: "Financials",
        layout: [
          { i: WIDGETS.navigation_bar.widgetId, x: 0, y: 0, w: 40, h: 2, static: true },
          {
            i: WIDGETS.financial_statements.widgetId,
            x: 0,
            y: 6,
            w: 40,
            h: 24,
          },
        ],
      },
      "technical-analysis": {
        id: "technical-analysis",
        name: "Technical Analysis",
        layout: [
          { i: WIDGETS.navigation_bar.widgetId, x: 0, y: 0, w: 40, h: 2, static: true },
          { i: WIDGETS.charting.widgetId, x: 0, y: 6, w: 40, h: 24 },
        ],
      },
      "comparison-analysis": {
        id: "comparison-analysis",
        name: "Comparison Analysis",
        layout: [
          { i: WIDGETS.navigation_bar.widgetId, x: 0, y: 0, w: 40, h: 2, static: true },
          { i: WIDGETS.grouped_comparison.widgetId, x: 20, y: 6, w: 40, h: 24 },
        ],
      },
      "ownership-analysis": {
        id: "ownership-analysis",
        name: "Ownership",
        layout: [
          { i: WIDGETS.navigation_bar.widgetId, x: 0, y: 0, w: 40, h: 2, static: true },
          {
            i: WIDGETS.institutional_ownership.widgetId,
            x: 0,
            y: 6,
            w: 40,
            h: 14,
          },
          { i: WIDGETS.stock_ownership.widgetId, x: 0, y: 20, w: 40, h: 16 },
          { i: WIDGETS.insider_trading.widgetId, x: 0, y: 36, w: 40, h: 16 },
        ],
      },
      "company-calendar": {
        id: "company-calendar",
        name: "Company Calendar",
        layout: [
          { i: WIDGETS.navigation_bar.widgetId, x: 0, y: 0, w: 40, h: 2, static: true },
          {
            i: WIDGETS.earning_history.widgetId,
            x: 0,
            y: 6,
            w: 25,
            h: 8,
          },
          { i: WIDGETS.stock_splits.widgetId, x: 25, y: 6, w: 15, h: 8 },
          { i: WIDGETS.dividend_payment.widgetId, x: 0, y: 14, w: 25, h: 16 },
          { i: WIDGETS.company_filings.widgetId, x: 25, y: 14, w: 15, h: 16 },
          { i: WIDGETS.earnings_transcripts.widgetId, x: 0, y: 20, w: 40, h: 16 },
        ],
      },
      "company-estimates": {
        id: "company-estimates",
        name: "Estimates",
        layout: [
          { i: WIDGETS.navigation_bar.widgetId, x: 0, y: 0, w: 40, h: 2, static: true },
          {
            i: WIDGETS.price_target.widgetId,
            x: 0,
            y: 38,
            w: 40,
            h: 12,
          },
        ],
      },
    },
    widgets: [
      WIDGETS.navigation_bar,
      WIDGETS.ticker_information,
      WIDGETS.price_performance,
      WIDGETS.key_metrics,
      WIDGETS.share_statistics,
      WIDGETS.company_profile,
      WIDGETS.revenue_per_geography,
      WIDGETS.management_team,
      WIDGETS.revenue_per_bus_line,
      WIDGETS.income_statement,
      WIDGETS.financial_ratios,
      WIDGETS.company_filings,
      WIDGETS.insider_trading,
      WIDGETS.price_target,
      WIDGETS.charting,
      WIDGETS.watchlist,
      WIDGETS.grouped_comparison,
      WIDGETS.financial_statements,
      WIDGETS.institutional_ownership,
      WIDGETS.stock_ownership,
      WIDGETS.stock_splits,
      WIDGETS.dividend_payment,
      WIDGETS.earning_history,
      WIDGETS.valuation_multiples,
      WIDGETS.earnings_transcripts,
    ] as Partial<WidgetJsonT>[],
  },
};

export type AvailableTemplates = keyof typeof TEMPLATES | "onboarding";

export function getAvailableTemplates(
  bundleInfo?: DataBundle | null,
): AvailableTemplates[] {
  const dataBundle = useFeatureFlagsStore.getState()?.featureFlags?.data_bundle_info;

  bundleInfo = bundleInfo ?? dataBundle;

  const allTemplates = [
    ...Object.keys(TEMPLATES),
    "onboarding",
  ] as AvailableTemplates[];

  if (bundleInfo === null) {
    // All templates if no bundle info is provided
    return allTemplates;
  }

  const excluded = bundleInfo?.except_dashboard_templates || [];
  const hasOnboarding = !excluded.includes("onboarding");

  if (excluded?.length > 0) {
    const filteredTemplates = allTemplates.filter(
      (template) =>
        !excluded?.includes(template) || (template === "onboarding" && hasOnboarding),
    );
    return Array.from(
      new Set([
        ...filteredTemplates,
        ...(hasOnboarding ? ["onboarding" as const] : []),
      ]),
    );
  }

  return allTemplates;
}
