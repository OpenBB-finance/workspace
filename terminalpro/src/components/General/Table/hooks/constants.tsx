import {
  colorSchemeDark,
  colorSchemeLight,
  createPart,
  type GridState,
  iconSetAlpine,
  themeAlpine,
} from "ag-grid-community";
import type { WidgetId } from "~/components/Widgets";
import type { ThemeDefaultParamsT } from "~/lib/state/tableChartThemes";
export const ignoreTranspose = ["institutional_ownership", "financial_ratios"] as const;

export const doAutoFitColumns = [
  "analyst_consensus",
  "key_metrics",
  "share_statistics",
  "dividend_payment",
  "company_filings",
  "institutional_ownership",
  "management_team",
  "earning_history",
  "watchlist",
  "analyst_price_target",
  "etf_holdings",
] as WidgetId[];

export const ignoreSources = [
  "rangeSelection",
  "cellSelection",
  "focusedCell",
  "scroll",
  // "pagination",
] as (keyof GridState | "gridInitializing" | "api")[];

const SHARED_PARAMS = {
  fontSize: 12,
  wrapperBorder: false,
  columnBorder: false,
  headerRowBorder: false,
  pickerButtonBorder: false,
  pinnedColumnBorder: false,
  pickerButtonBackgroundColor: "transparent",
  pickerButtonFocusBorder: false,
  inputFocusBorder: false,
  inputFocusBackgroundColor: "transparent",
  borderRadius: 0,
  pickerButtonFocusBackgroundColor: "transparent",
  rowBorder: { width: 0.5 },
  headerColumnResizeHandleWidth: 1,
  cellHorizontalPadding: 7,
  accentColor: "#337dba",
} as ThemeDefaultParamsT;

export const customCssPart = createPart({
  feature: "customCss",
  params: {
    altHeaderBackgroundColor: undefined,
    evenRowBackgroundColor: undefined,
  },
  css: `
.ag-header {
  background-color: var(--ag-alt-header-background-color, --ag-header-background-color) !important;
}
.ag-row-even {
  background-color: var(--ag-even-row-background-color, --ag-background-color) !important;
}
.ag-status-bar {
  background-color: var(--ag-background-color) !important;
}
`,
});

const themeParams = {
  dark: {
    ...SHARED_PARAMS,
    headerBackgroundColor: "#24242aff",
    headerColumnResizeHandleColor: "white",
    backgroundColor: "#151518ff",
    evenRowBackgroundColor: "#1f1e23",
    oddRowBackgroundColor: "#2a2a31",
    menuBorder: { width: 1, color: "#36363f", style: "solid" },
    menuBackgroundColor: "#24242aff",
    menuShadow: {
      offsetX: 0,
      offsetY: 2,
      radius: 10,
      spread: 0,
      color: "rgba(0, 0, 0, 0.4)",
    },
    selectedRowBackgroundColor: "#334859",
    panelBackgroundColor: "#24242aff",
    columnDropCellBackgroundColor: "#2a2a31",
    altHeaderBackgroundColor: "#36363f",
    sideButtonBarBackgroundColor: "#24242aff",
    sideBarBackgroundColor: "#24242aff",
  },
  light: {
    ...SHARED_PARAMS,
    headerBackgroundColor: "#f6f6f6",
    headerColumnResizeHandleColor: "#181d1f",
    oddRowBackgroundColor: "#f6f6f6",
    selectedRowBackgroundColor: "#ccdeee",
    menuBorder: { width: 1, color: "rgba(218, 219, 222, 1)", style: "solid" },
    menuShadow: {
      offsetX: 0,
      offsetY: 2,
      radius: 10,
      spread: 0,
      color: "rgba(0, 0, 0, 0.1)",
    },
    altHeaderBackgroundColor: "#EBEBED",
    evenRowBackgroundColor: "#fff",
    sideButtonBarBackgroundColor: "#f6f6f6",
    sideBarBackgroundColor: "#f6f6f6",
  },
} as Record<"dark" | "light", ThemeDefaultParamsT>;

const darkTheme = themeAlpine
  .withPart(colorSchemeDark)
  .withPart(iconSetAlpine)
  .withPart(customCssPart)
  .withParams({ ...themeParams.dark });

const lightTheme = themeAlpine
  .withPart(colorSchemeLight)
  .withPart(iconSetAlpine)
  .withPart(customCssPart)
  .withParams({ ...themeParams.light });

export function getDefaultAgGridTheme(theme: "dark" | "light") {
  return theme === "dark" ? darkTheme : lightTheme;
}

export function getDefaultAgGridThemeParams(theme: "dark" | "light") {
  return themeParams[theme] || themeParams.dark;
}
