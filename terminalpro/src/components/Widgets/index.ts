import { lazy } from "react";
import { WidgetDataProcessors } from "~/components/Widgets/dataProcessors";
import { BLOCKED_WIDGET_IDS } from "~/lib/constants";
import type { WidgetsIds } from "~/lib/utils/widget";
import type { WidgetT } from "../types";

const AgChartFC = lazy(() => import("./AgChart"));
const AgWebSocketsFC = lazy(() => import("../General/Table/AgWebSockets"));
const CurrencySnapshotFC = lazy(() => import("../Widgets/Currency/CurrencySnapshot"));
const MarkdownFC = lazy(() => import("./custom/Markdown"));
const AgChartFromTableFC = lazy(() => import("../General/Table/AgChartFromTable"));
const AgGridFileFC = lazy(() => import("../General/Table/AgGridFile"));
const AgGridSQLFC = lazy(() => import("../General/Table/AgGridSQL"));
const AgGridSSRMFC = lazy(() => import("../General/Table/AgGridSSRM"));
const AgGridSSRMAdvancedFC = lazy(() => import("../General/Table/AgGridSSRMAdvanced"));
const AgGridTableFC = lazy(() => import("../General/Table/AgGridTable"));
const ChartFC = lazy(() => import("./Chart"));
const ChartHighchartsFC = lazy(() => import("./charting/ChartHighcharts"));
const ChartVegaLiteFC = lazy(() => import("./charting/ChartVegaLite"));

const MetricWidgetFC = lazy(() => import("./Metric"));
const FileViewerWidgetFC = lazy(() => import("./FileView"));
const OmniWidgetFC = lazy(() => import("./OmniWidget"));
const ClockWidgetFC = lazy(() => import("./Clock"));
const CountryIndicatorsFC = lazy(() => import("./Economy/CountryIndicators"));
const ForwardTrendsFC = lazy(() => import("./Equity/ForwardTrends"));
const ETFClassificationFC = lazy(() => import("./ETF/Classification"));
const ETFCharacteristicsFC = lazy(() => import("./ETF/Characteristics"));
const EconomicCalendarFC = lazy(() => import("./Economy/EconomicCalendar"));
const EconomicOverviewFC = lazy(() => import("./Economy/EconomicOverview"));
const EconomicIndicatorsFC = lazy(() => import("./Economy/EconomicIndicators"));
const CopilotTableFC = lazy(() => import("./AI/CopilotTable"));
const AnalystEstimatesFC = lazy(() => import("./Equity/AnalystEstimates"));
const CompanyEventsFC = lazy(() => import("./Equity/CompanyEvents"));
const CompanyProfileFC = lazy(() => import("./Equity/CompanyProfile"));
const GroupedComparisonFC = lazy(
  () => import("./Equity/ComparisonAnalysis/GroupedComparison"),
);
const EarningsTranscriptFC = lazy(
  () => import("./Equity/EarningsTranscript/EarningsTranscript"),
);
const SingleEarningsTranscriptFC = lazy(
  () => import("./Equity/EarningsTranscript/SingleEarningsTranscript"),
);
const InstitutionalOwnershipFC = lazy(() => import("./Equity/InstitutionalOwnership"));
const KeyMetricsFC = lazy(() => import("./Equity/KeyMetrics"));
const NewsFC = lazy(() => import("./Equity/News/News"));
const CustomNewsFC = lazy(() => import("./custom/News"));
const SingleNewsFC = lazy(() => import("./Equity/News/SingleNews"));
const PricePerformanceFC = lazy(() => import("./Equity/PricePerformance"));
const PriceTargetByAnalystFC = lazy(() => import("./Equity/PriceTargetByAnalyst"));
const RevenuePerFC = lazy(() => import("./Equity/RevenuePer"));
const ShareStatisticsFC = lazy(() => import("./Equity/ShareStatistics"));
const SingleBarOverviewFC = lazy(() => import("./Equity/SingleBarOverview"));
const TickerSummaryFC = lazy(() => import("./Equity/TickerSummary"));
const TopBarOverviewFC = lazy(() => import("./Equity/TopBarOverview"));
const WatchlistFC = lazy(() => import("./Equity/Watchlist"));
const GroupedFinancialsFC = lazy(() => import("./GroupedFinancials"));
const IframeFC = lazy(() => import("./Iframe"));
const YouTubeFC = lazy(() => import("./YouTube"));
const ChartingFC = lazy(() => import("./Misc/Charting"));
const MarkdownEditorFC = lazy(() => import("./Misc/Editing/MarkdownEditor"));
const RSSViewerFC = lazy(() => import("./RssViewer"));
const XMLViewerFC = lazy(() => import("./XmlViewer"));
const NavigationBarFC = lazy(() => import("./ui/NavigationBar"));
const BigStoriesFC = lazy(() => import("./Equity/News/BigStories"));
const AdvancedWidgetFC = lazy(() => import("./TVWidgets/AdvancedWidget"));
const TechnicalAnalysisFC = lazy(() => import("./TVWidgets/TechnicalAnalysisWidget"));
const MarketOverviewFC = lazy(() => import("./TVWidgets/MarketOverviewWidget"));
const MarketDataFC = lazy(() => import("./TVWidgets/MarketDataWidget"));
const StockMarketFC = lazy(() => import("./TVWidgets/StockMarketWidget"));
const UpcomingEconomicEventsFC = lazy(
  () => import("./TVWidgets/EconomicCalendarWidget"),
);
const TickerFC = lazy(() => import("./TVWidgets/TickerWidget"));
const TickerTapeFC = lazy(() => import("./TVWidgets/TickerTapeWidget"));
const MiniChartWidgetFC = lazy(() => import("./TVWidgets/MiniChartWidget"));
const SymbolInfoFC = lazy(() => import("./TVWidgets/SymbolInfo"));
const SymbolOverviewFC = lazy(() => import("./TVWidgets/SymbolOverview"));
const ForexCrossRatesFC = lazy(() => import("./TVWidgets/ForexCrossRatesWidget"));
const ForexHeatMapFC = lazy(() => import("./TVWidgets/ForexHeatMapWidget"));
const ForexScreenerFC = lazy(() => import("./TVWidgets/ForexScreenerWidget"));
const CryptoScreenerFC = lazy(() => import("./TVWidgets/CryptoScreenerWidget"));
const CryptocurrencyMarketFC = lazy(
  () => import("./TVWidgets/CryptocurrencyMarketWidget"),
);
const FundamentalDataFC = lazy(() => import("./TVWidgets/FundamentalDataWidget"));
const CompanyProfileDescriptionFC = lazy(
  () => import("./TVWidgets/CompanyProfileWidget"),
);
const TimelineFC = lazy(() => import("./TVWidgets/TimelineWidget"));
const CryptoCoinsHeatmapFC = lazy(() => import("./TVWidgets/CryptoCoinsHeatMapWidget"));
const StockHeatMapFC = lazy(() => import("./TVWidgets/StockHeatMapWidget"));
const SingleTickerFC = lazy(() => import("./TVWidgets/SingleTickerWidget"));
const MarketTimelineFC = lazy(() => import("./TVWidgets/MarketTimelineWidget"));
const PythPriceFeedsTableFC = lazy(() => import("./Pyth/PriceFeeds.table"));
const PdfViewerFC = lazy(() => import("./PdfViewer"));
const ImageViewerFC = lazy(() => import("./ImageViewer"));
const HtmlViewerFC = lazy(() => import("./custom/HtmlViewer"));
const MultiFileViewerFC = lazy(() => import("./MultiFileViewer"));

export const AgGridComponents = {
  ag_grid_file: "AgGridFile",
  ag_grid_sql: "AgGridSQL",
  ag_grid_table: "AgGridTable",
  ssrm_table: "AgGridSSRM",
  ssrm_advanced: "AgGridSSRMAdvanced",
  analyst_estimates: "AnalystEstimates",
  financial_statements: "GroupedFinancials",
  watchlist: "Watchlist",
  key_metrics: "KeyMetrics",
  share_statistics: "ShareStatistics",
  grouped_comparison: "GroupedComparison",
  currency_snapshot: "CurrencySnapshot",
  institutional_ownership: "InstitutionalOwnership",
  etf_classification: "ETFClassification",
  etf_characteristics: "ETFCharacteristics",
  xml_viewer: "XMLViewer",
  earning_history: "CompanyEvents",
  copilot_table: "CopilotTable",
  revenue_per: "RevenuePer",
  revenue_per_bus_line: "RevenuePer",
  revenue_per_geography: "RevenuePer",
  earnings_trends: "ForwardTrends",
  revenue_trends: "ForwardTrends",
  pyth_price_feeds: "PythPriceFeedsTable",
  live_grid: "AgWebSockets",
  omni: "OmniWidget",
} as const;

export const NonAgGridComponents = {
  charting: "Charting",
  chart: "Chart",
  "chart-highcharts": "ChartHighcharts",
  "chart-vegalite": "ChartVegaLite",
  advanced_charting: "Charting",
  clock: "ClockWidget",
  metric: "MetricWidget",
  file_viewer: "FileViewerWidget",
  company_profile: "CompanyProfile",
  earnings_transcripts: "EarningsTranscript",
  iframe: "Iframe",
  youtube: "YouTube",
  rss_viewer: "RSSViewer",
  ticker_summary: "TickerSummary",
  rich_note: "MarkdownEditor",
  markdown: "Markdown",
  pdf: "PdfViewer",
  html: "HtmlViewer",
  price_performance: "PricePerformance",
  single_news: "SingleNews",
  single_earnings_transcript: "SingleEarningsTranscript",
  navigation_bar: "NavigationBar",
  market_indices: "TopBarOverview",
  ticker_information: "SingleBarOverview",
  ag_chart_from_table: "AgChartFromTable",
  ag_chart: "AgChart",
  company_news: "News",
  big_stories: "BigStories",
  tv_charting: "AdvancedWidget",
  tv_ta: "TechnicalAnalysisWidget",
  tv_market_overview: "MarketOverview",
  tv_market_data: "MarketData",
  tv_stock_market: "StockMarket",
  tv_upcoming_economic_events: "UpcomingEconomicEvents",
  tv_ticker: "Ticker",
  tv_ticker_tape: "TickerTape",
  tv_mini_chart: "MiniChartWidget",
  tv_symbol_info: "SymbolInfo",
  tv_symbol_overview: "SymbolOverview",
  tv_forex_cross_rates: "ForexCrossRates",
  tv_forex_heatmap: "ForexHeatMap",
  tv_forex_screener: "ForexScreener",
  tv_crypto_screener: "CryptoScreener",
  tv_cryptocurrency_market: "CryptocurrencyMarket",
  tv_fundamental_data: "FundamentalData",
  tv_company_profile: "CompanyProfileDescription",
  tv_timeline: "Timeline",
  tv_market_timeline: "MarketTimeline",
  tv_stock_heatmap: "StockHeatMap",
  tv_crypto_coins_heatmap: "CryptoCoinsHeatmap",
  tv_single_ticker: "SingleTicker",
  multi_file_viewer: "MultiFileViewer",
  newsfeed: "CustomNews",
  // mini_sparkline_charts: "MarketOverviewCustom", commented for now until we finish the component
} as const;

export const Widgets = {
  AgChart: AgChartFC,
  AgWebSockets: AgWebSocketsFC,
  CurrencySnapshot: CurrencySnapshotFC,
  Markdown: MarkdownFC,
  AgChartFromTable: AgChartFromTableFC,
  AgGridFile: AgGridFileFC,
  AgGridSQL: AgGridSQLFC,
  AgGridSSRM: AgGridSSRMFC,
  AgGridSSRMAdvanced: AgGridSSRMAdvancedFC,
  AgGridTable: AgGridTableFC,
  Chart: ChartFC,
  ChartHighcharts: ChartHighchartsFC,
  ChartVegaLite: ChartVegaLiteFC,
  MetricWidget: MetricWidgetFC,
  FileViewerWidget: FileViewerWidgetFC,
  OmniWidget: OmniWidgetFC,
  ClockWidget: ClockWidgetFC,
  CountryIndicators: CountryIndicatorsFC,
  ForwardTrends: ForwardTrendsFC,
  ETFClassification: ETFClassificationFC,
  ETFCharacteristics: ETFCharacteristicsFC,
  EconomicCalendar: EconomicCalendarFC,
  EconomicOverview: EconomicOverviewFC,
  EconomicIndicators: EconomicIndicatorsFC,
  CopilotTable: CopilotTableFC,
  AnalystEstimates: AnalystEstimatesFC,
  CompanyEvents: CompanyEventsFC,
  CompanyProfile: CompanyProfileFC,
  GroupedComparison: GroupedComparisonFC,
  EarningsTranscript: EarningsTranscriptFC,
  SingleEarningsTranscript: SingleEarningsTranscriptFC,
  InstitutionalOwnership: InstitutionalOwnershipFC,
  KeyMetrics: KeyMetricsFC,
  News: NewsFC,
  CustomNews: CustomNewsFC,
  SingleNews: SingleNewsFC,
  PricePerformance: PricePerformanceFC,
  PriceTargetByAnalyst: PriceTargetByAnalystFC,
  RevenuePer: RevenuePerFC,
  ShareStatistics: ShareStatisticsFC,
  SingleBarOverview: SingleBarOverviewFC,
  TickerSummary: TickerSummaryFC,
  TopBarOverview: TopBarOverviewFC,
  Watchlist: WatchlistFC,
  GroupedFinancials: GroupedFinancialsFC,
  Iframe: IframeFC,
  YouTube: YouTubeFC,
  Charting: ChartingFC,
  MarkdownEditor: MarkdownEditorFC,
  RSSViewer: RSSViewerFC,
  XMLViewer: XMLViewerFC,
  NavigationBar: NavigationBarFC,
  BigStories: BigStoriesFC,
  AdvancedWidget: AdvancedWidgetFC,
  TechnicalAnalysisWidget: TechnicalAnalysisFC,
  MarketOverview: MarketOverviewFC,
  MarketData: MarketDataFC,
  StockMarket: StockMarketFC,
  UpcomingEconomicEvents: UpcomingEconomicEventsFC,
  Ticker: TickerFC,
  TickerTape: TickerTapeFC,
  MiniChartWidget: MiniChartWidgetFC,
  SymbolInfo: SymbolInfoFC,
  SymbolOverview: SymbolOverviewFC,
  ForexCrossRates: ForexCrossRatesFC,
  ForexHeatMap: ForexHeatMapFC,
  ForexScreener: ForexScreenerFC,
  CryptoScreener: CryptoScreenerFC,
  CryptocurrencyMarket: CryptocurrencyMarketFC,
  FundamentalData: FundamentalDataFC,
  CompanyProfileDescription: CompanyProfileDescriptionFC,
  Timeline: TimelineFC,
  CryptoCoinsHeatmap: CryptoCoinsHeatmapFC,
  StockHeatMap: StockHeatMapFC,
  SingleTicker: SingleTickerFC,
  MarketTimeline: MarketTimelineFC,
  PythPriceFeedsTable: PythPriceFeedsTableFC,
  PdfViewer: PdfViewerFC,
  ImageViewer: ImageViewerFC,
  HtmlViewer: HtmlViewerFC,
  MultiFileViewer: MultiFileViewerFC,
  //MarketOverviewCustom: MarketOverviewCustomFC,
} as const;

export default Widgets;

export type WidgetComponentName = keyof typeof Widgets;
export type WidgetComponent<T extends WidgetComponentName> = (typeof Widgets)[T];

export const WidgetComponentMap = {
  ...AgGridComponents,
  ...NonAgGridComponents,
};

export type WidgetId<T = keyof typeof WidgetComponentMap | WidgetsIds> =
  T extends keyof typeof WidgetComponentMap ? T : T extends WidgetsIds ? T : string;

export type WidgetComponentMapT = {
  [key in WidgetId]: WidgetComponentName;
};

type DataProcessorT = (queryData: any, widget: WidgetT) => { rowData: any[] };

const getDataProcessor = (widgetId: WidgetId): DataProcessorT | undefined => {
  return WidgetDataProcessors?.[WidgetComponentMap?.[widgetId]];
};

type QueryDataT = { results?: any[] };

export function getParsedWidgetData(queryData: QueryDataT, widget: WidgetT) {
  const dataProcessor = getDataProcessor(widget?.widgetId);

  const rowData = dataProcessor?.(queryData, widget)?.rowData;
  return rowData || queryData?.results || queryData;
}

export const getWidgetComponent = (
  widgetId: WidgetId,
): WidgetComponent<WidgetComponentName> => {
  if (BLOCKED_WIDGET_IDS.has(widgetId)) return;

  return Widgets?.[WidgetComponentMap?.[widgetId]];
};

export const isAgGridWidget = (widgetId: WidgetId): boolean => {
  if (BLOCKED_WIDGET_IDS.has(widgetId)) return false;
  return Object.keys(AgGridComponents).includes(widgetId);
};
