import type {
  ChartingLibraryWidgetOptions,
  CustomIndicator,
  LanguageCode,
  LibrarySymbolInfo,
  PineJS,
  ResolutionString,
  TimeFrameItem,
} from "~/lib/charting_library";
import { formatPrice } from "../../Pyth/utils";
import BalanceIndicator from "../../TVStudies/Balance";
import CashFlowIndicator from "../../TVStudies/CashFlow";
import IncomeIndicator from "../../TVStudies/Income";
import DataFeed from "../datafeed";
import type { ChartDataFeed } from "../type";

function getLanguageFromURL(): LanguageCode | null {
  const regex = /[?&]lang=([^&#]*)/;
  const results = regex.exec(window.location.search);
  return results === null
    ? null
    : (decodeURIComponent(results[1].replace(/\+/g, " ")) as LanguageCode);
}

const TVChartsDefault = (
  chartId: string,
): ChartingLibraryWidgetOptions & { datafeed: ChartDataFeed } => {
  const dataFeed = DataFeed(chartId);

  return {
    // BEWARE: no trailing slash is expected in feed URL
    // tslint:disable-next-line:no-any
    container: "tv_chart_container" as ChartingLibraryWidgetOptions["container"],
    datafeed: dataFeed,
    interval: "D" as ResolutionString,
    library_path: "/assets/js/charting_library/",
    locale: getLanguageFromURL() || "en",
    disabled_features: [
      "header_screenshot",
      "header_fullscreen_button",
      "header_undo_redo",
      "show_symbol_logo_for_compare_studies",
      "use_localstorage_for_settings",
      "save_chart_properties_to_local_storage",
    ] as ChartingLibraryWidgetOptions["disabled_features"],
    enabled_features: [
      "show_symbol_logos",
      "show_spread_operators",
      "countdown",
      "study_templates",
      "chart_template_storage",
      "confirm_overwrite_if_chart_layout_with_name_exists",
      "pre_post_market_sessions",
      "drawing_templates",
      "request_only_visible_range_on_reset",
      "determine_first_data_request_size_using_visible_range",
      "shift_visible_range_on_new_bar",
      "hide_price_scale_if_all_sources_hidden",
      "fix_left_edge",
      "use_last_visible_bar_value_in_legend",
      "hide_exponentiation_spread_operator",
      "hide_reciprocal_spread_operator",
      "allow_arbitrary_symbol_search_input",
    ] as ChartingLibraryWidgetOptions["enabled_features"],
    time_frames: [
      { text: "5y", resolution: "1D", description: "5 Years", title: "5yr" },
      { text: "3y", resolution: "1D", description: "3 Years", title: "3yr" },
      { text: "1y", resolution: "1D", description: "1 Year", title: "1yr" },
      { text: "6m", resolution: "1D", description: "6 Months", title: "6mo" },
      { text: "3m", resolution: "1D", description: "3 Months", title: "3mo" },
      { text: "1w", resolution: "15", description: "1 Week", title: "1wk" },
    ] as TimeFrameItem[],
    symbol_search_request_delay: 300,
    auto_save_delay: 5,
    client_id: undefined,
    user_id: undefined,
    fullscreen: false,
    autosize: true,
    studies_overrides: {},
    custom_css_url: "/assets/css/tv.css",
    custom_indicators_getter: (PineJS: PineJS): Promise<CustomIndicator[]> =>
      Promise.resolve([
        IncomeIndicator(PineJS),
        CashFlowIndicator(PineJS),
        BalanceIndicator(PineJS),
      ]),
    timezone: "exchange",
    load_last_chart: true,
    theme: "dark",
    custom_formatters: {
      priceFormatterFactory: (
        _symbolInfo: LibrarySymbolInfo | null,
        minTick: string,
      ) => {
        if (minTick === "default") {
          return {
            format: (price, _signPositive) => formatPrice(price),
          };
        }

        return null;
      },
    },
  };
};

export default TVChartsDefault;
