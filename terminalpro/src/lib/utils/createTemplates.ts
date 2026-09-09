import type { NavigateFunction } from "react-router-dom";
import { getExternalCopilotHolders } from "~/api/auth.api";
import { saveDashboards } from "~/api/dashboard.api";
import type { SecurityType } from "~/components/Charting/constants";
import {
  createSourceWidget,
  updateParamOrder,
} from "~/components/DataConnectors/common/helpers";
import { getStateKey } from "~/components/General/Table/hooks/useUpdateColumnState";
import { someTruthy } from "~/components/General/Table/utils";
import type { GroupTypeT, WidgetJsonT, WidgetT } from "~/components/types";
import { resultsToTicker } from "~/components/Widgets/Helpers/AdvancedSelectTicker";
import Onboarding from "~/lib/onboarding_new.json";
import type { DashboardTypes, DataBundle } from "~/lib/state/featureFlags";
import { fetchQuerySymbols } from "../api/sdkComponents";
import type {
  AppState,
  GridLayout,
  Items,
  TabData,
  Ticker,
  Widget,
} from "../state/app";
import type { BackendTemplate, Source } from "../state/backendConnector";
import { useCopilotStore } from "../state/copilot";
import { useThemeStore } from "../state/theme";
import { type TabLayout, TEMPLATES } from "../templates";
import { DEFAULT_TICKERS } from "../types";
import { backendTemplateSchema } from "../types/app";
import {
  addToWidgetParamGroups,
  getGridData,
  getTickerParamName,
  getValidItems,
  MainTickerByCategory,
  recursiveCleanKeys,
} from "./app";
import { COLORS, slugify, uuidv4 } from "./utils";
import { getJsonWidget } from "./widget";
import { currentDateModifier } from "./widgetParams";

export const ONBOARDING_STORED_FILES = {
  "file-c0ebd61e-39fa-4382-b82f-4374ea96a30f": {
    urlDev:
      "https://backend.openbb.dev/pro/files/983fe57c-063d-4463-83f3-158527144a23.pdf",
    urlProd:
      "https://backend.openbb.co/pro/files/f24b8fa7-adbd-4770-89d2-d364862ef256.pdf",
  },
};

export const OPENBB_ONBOARDING_WIDGETS = Array.from(
  new Set<string>(Onboarding.widgets.map((w) => w.widgetId)),
).map((widgetId) => {
  const widget = Onboarding.widgets.find((w) => w.widgetId === widgetId);
  return {
    name: widget?.name,
    widgetId,
  };
});

function getTickerSymbolsFromParams(
  params: Record<string, unknown>,
  paramName: string,
) {
  const value = params[paramName];
  if (typeof value === "string") {
    return value
      .split(",")
      .map((symbol) => symbol.trim())
      .filter(Boolean);
  }
  if (value && typeof value === "object" && "symbol" in value) {
    const symbol = String((value as { symbol?: unknown }).symbol || "").trim();
    return symbol ? [symbol] : [];
  }
  return [];
}

async function resolveTickerSymbol(symbol: string): Promise<Ticker> {
  const normalizedSymbol = symbol.toUpperCase();
  try {
    const { results } = await fetchQuerySymbols({
      queryParams: {
        q: normalizedSymbol,
      },
    });
    const ticker = resultsToTicker(results).find(
      (result) => result?.symbol?.toUpperCase() === normalizedSymbol,
    );
    if (ticker) return ticker;
  } catch {
    // Keep the model-selected symbol instead of falling back to a different asset.
  }

  return {
    id: normalizedSymbol,
    symbol: normalizedSymbol,
    name: normalizedSymbol,
    category: "equity",
    type: "stock",
  };
}

function tickerToSecurity(ticker: Ticker): SecurityType {
  const category =
    ticker.category === "crypto"
      ? "crypto"
      : ticker.category === "index"
        ? "indices"
        : "securities";

  return {
    id: ticker.id || ticker.symbol,
    symbol: ticker.symbol,
    label: ticker.name || ticker.symbol,
    color: ticker.color || "",
    category,
    metrics: [],
    active: true,
  };
}

function getTabs(templateName: string): { id: string; name: string }[] {
  const template = TEMPLATES[templateName];
  if (!template) {
    throw new Error(`Template ${templateName} not found`);
  }

  return Object.values(template.tabs).map((tab: any) => ({
    id: tab.id,
    name: tab.name,
  }));
}

/**
 * Checks if there are any existing dashboards for a given app that haven't been modified by the user.
 * If such a dashboard exists, it returns the corresponding tab information and navigation path.
 * If all existing dashboards have been modified, it generates a new unique tab name for the app.
 *
 * @param templateId - The unique identifier for the app template.
 * @param appName - The name of the app to be used in the tab name.
 * @param items - The current list of dashboard items to check against.
 *
 * @returns An object containing either the index and navigation path for an untouched dashboard,
 * or a new tab name for a modified app.
 */
export function getUntouchedAppTabInfo(
  templateId: BackendTemplate["id"],
  appName: string,
  items: Items,
  allowUntouchedReuse = true,
) {
  const cleanAppName = appName.replace(/\s*\(\d+\)$/, "");
  const appDashboards = Object.values(items || {}).filter((item) => {
    if (item?.isFolder || !item?.index || !item?.data) return false;
    const data = item.data;
    return data.templateId === templateId && data.name.startsWith(cleanAppName);
  });

  const untouchedDashboard = appDashboards.find(
    (item) => item.data.numberOfChanges === 0,
  );
  if (allowUntouchedReuse && untouchedDashboard?.index) {
    const { index, data } = untouchedDashboard;
    const navigateTo = `/app/${index}${data?.currentTab ? `?tab=${data.currentTab}` : ""}`;
    return { index, navigateTo };
  }
  const maxCount = appDashboards.reduce(
    (max, item) => {
      const name = item.data?.name || "";
      const numberMatch = name.match(/\((\d+)\)$/);
      const number = numberMatch ? Number.parseInt(numberMatch[1], 10) : 0;
      return Math.max(max, number);
    },
    appDashboards.length > 0 ? 1 : 0,
  );

  const tabName = cleanAppName + (maxCount > 0 ? ` (${maxCount + 1})` : "");
  return { tabName };
}

export async function createCustomTemplateTab({
  addTab,
  navigate = null,
  items,
  template,
  source,
  currentDashboard = "",
  resolveWidgetSource,
  resolveWidget,
  dashboardBehavior = "auto",
}: {
  addTab: AppState["addTab"];
  navigate?: NavigateFunction;
  items: Items;
  template: BackendTemplate;
  source: Source;
  currentDashboard?: string;
  dashboardBehavior?: "auto" | "current" | "new";
  /**
   * Resolve the backend Source for a single widget id. When provided, each widget is
   * resolved against its own Source (multi-origin apps); when omitted, the single
   * `source` is used for every widget (the apps-gallery path).
   */
  resolveWidgetSource?: (widgetId: string) => Source | undefined;
  resolveWidget?: (widgetId: string) => Widget | WidgetJsonT | WidgetT | undefined;
}): Promise<string | undefined> {
  const sourceId = source.id ?? source.uuid;
  const templateId = `custom-${sourceId}-${slugify(template.name)}` as const;
  const { index, tabName, navigateTo } = getUntouchedAppTabInfo(
    templateId,
    template.name,
    items,
    dashboardBehavior === "auto",
  );

  if (navigateTo) {
    if (navigate) navigate(navigateTo);
    return index;
  }

  const currentDashboardItem = items?.[currentDashboard];
  const hasZeroWidgets = currentDashboardItem?.data?.widgets?.length === 0;

  const shouldUseCurrentDashboard =
    !!currentDashboard &&
    dashboardBehavior !== "new" &&
    (dashboardBehavior === "current" || hasZeroWidgets);
  const id = shouldUseCurrentDashboard ? currentDashboard : uuidv4();
  const gridLayout = {} as GridLayout;
  const templateWidgets: (Widget | WidgetJsonT)[] = [];
  const unresolvedWidgetIds = new Set<string>();

  template = backendTemplateSchema.parse(template) as unknown as BackendTemplate;

  const temporaryGroups =
    template.groups?.map((group, index) => {
      const groupId = uuidv4();
      const color = COLORS[index % COLORS.length];

      if (
        typeof group.defaultValue === "string" &&
        group.defaultValue.startsWith("$currentDate")
      ) {
        group.defaultValue = currentDateModifier(group.defaultValue);
      }

      return {
        id: groupId,
        color,
        name: group.name,
        type: group.type ?? "endpointParam",
        groupById: group.paramName,
        // adding temporarily so i can match the widgets to the groups,
        // we remove this later before creating the dashboard
        widgetIds: group.widgetIds,
        value: group.defaultValue,
      } as GroupTypeT<"endpointParam" | "param" | "ticker"> & { widgetIds: string[] };
    }) || [];

  let hasNavigationBar = false;
  for (const tabId in template.tabs) {
    if (template.tabs.hasOwnProperty(tabId)) {
      const tab = template.tabs[tabId];
      gridLayout[tab.id] = [];

      for await (const layout of tab.layout) {
        const { i: widgetId, state, groups, ...restGridData } = layout;
        const widgetSource = resolveWidgetSource
          ? resolveWidgetSource(widgetId)
          : source;
        const sourceWidget = widgetSource?.widgets?.[widgetId];

        if (widgetId === "navigation_bar") {
          hasNavigationBar = true;
          continue;
        }

        const appWidget =
          resolveWidget?.(widgetId) ??
          (sourceWidget && widgetSource
            ? createSourceWidget({ ...sourceWidget, widgetId }, widgetSource)
            : getJsonWidget(widgetId));

        if (!appWidget) {
          if (resolveWidgetSource || resolveWidget) unresolvedWidgetIds.add(widgetId);
          continue;
        }

        const { gridData, ...widget } = appWidget as Widget;

        const minimizedFlag = (restGridData as { minimized?: boolean }).minimized;
        const isMinimized = minimizedFlag === true || restGridData.h === 1;
        const originalH = isMinimized ? restGridData.h : gridData?.h || restGridData.h;

        const endpointParams = widget?.params
          ?.filter((p) => p.type === "endpoint")
          ?.reduce((acc, p) => {
            acc[p.paramName] = p?.groupById;
            return acc;
          }, {});

        const widgetUniqueId = uuidv4();

        const finalGridData = getGridData(
          null,
          { ...(gridData || {}), ...restGridData, i: widgetUniqueId },
          { keepXY: true },
        );
        if (isMinimized) {
          finalGridData.originalMinH = finalGridData.minH;
          finalGridData.minH = 1.4;
          finalGridData.h = 1.4;
        }
        gridLayout[tab.id].push(finalGridData);

        const tempGroups = temporaryGroups.filter((g) => groups?.includes(g.name));

        for await (const group of tempGroups) {
          if (
            group?.type === "endpointParam" &&
            !group?.groupById &&
            widget.groupById
          ) {
            group.groupById = widget.groupById;
          }

          if (group?.type === "endpointParam" && endpointParams?.[group?.groupById]) {
            group.groupById = endpointParams?.[group?.groupById];
          }

          if (group?.type === "param" || group?.type === "endpointParam") {
            widget.paramGroups = addToWidgetParamGroups(widget?.paramGroups, group);
          }

          if (group?.type === "ticker") {
            if (!group?.value?.symbol) {
              const symbol = group?.value as unknown as string;
              group.value = await fetchQuerySymbols({
                queryParams: {
                  q: symbol,
                },
              })
                .then(async ({ results }) => {
                  const newTicker = resultsToTicker(results).find(
                    (result) => result?.symbol === symbol,
                  );
                  return newTicker || DEFAULT_TICKERS.AAPL;
                })
                .catch(() => DEFAULT_TICKERS.AAPL);
            }

            widget.data = {
              ...(widget.data ?? {}),
              mainTicker: group.value,
            };
            widget.groupId = group.id;
          }
        }

        widget.params = updateParamOrder(state?.paramOrder, widget.params);

        const {
          chartModel,
          chartView,
          columnState,
          filterModel,
          params = {},
          storage,
        } = recursiveCleanKeys(state ?? {}) as TabLayout["state"];
        if (someTruthy(...Object.values(state ?? {}))) {
          widget.data = {
            ...(widget.data ?? {}),
            table: {
              ...(widget.data?.table ?? {}),
              ...(columnState && { columnState }),
              ...(filterModel && { filterModel }),
              ...(chartView && { chartView }),
            },
          };
          const chartType = chartModel?.chartType;
          const cellRange = chartModel?.cellRange;

          widget.storage = {
            ...(widget.storage ?? {}),
            ...(chartView && { chartView }),
            ...(storage ?? {}),
            params,
          };

          if (chartType && chartView) {
            widget.storage.chartView.chartType = chartType;
          }
          const stateKey = getStateKey(widget);

          widget.storage[stateKey] = {
            ...(widget.storage?.[stateKey] ?? {}),
            ...(chartModel && {
              chartModel,
              ...(chartType && { [chartType]: { cellRange } }),
            }),
          };
        }

        const tickerParamName = getTickerParamName(widget as Widget);
        const tickerSymbols = tickerParamName
          ? getTickerSymbolsFromParams(params, tickerParamName)
          : [];
        const tickerSymbol = tickerSymbols[0];
        const shouldSetSecondaryTickers =
          tickerSymbols.length > 1 &&
          ["watchlist", "grouped_comparisons", "peers_list"].includes(widget.widgetId);
        const shouldResolveAllTickers =
          shouldSetSecondaryTickers || widget.widgetId === "market_indices";
        const resolvedTickers = shouldResolveAllTickers
          ? await Promise.all(tickerSymbols.map(resolveTickerSymbol))
          : undefined;
        const secondaryTickers = shouldSetSecondaryTickers
          ? resolvedTickers
          : undefined;
        if (tickerParamName && tickerSymbol) {
          const mainTicker =
            resolvedTickers?.[0] ?? (await resolveTickerSymbol(tickerSymbol));
          widget.data = {
            ...(widget.data ?? {}),
            mainTicker,
            ...(secondaryTickers && { secondaryTickers }),
          };
          const securities =
            widget.widgetId === "market_indices" && resolvedTickers?.length
              ? resolvedTickers.map(tickerToSecurity)
              : undefined;
          if (securities) {
            widget.data = {
              ...(widget.data ?? {}),
              securities,
            };
          }
          widget.storage = {
            ...(widget.storage ?? {}),
            ...(securities && { securities }),
            params: {
              ...(widget.storage?.params ?? {}),
              ...params,
              [tickerParamName]:
                typeof params[tickerParamName] === "string"
                  ? tickerSymbols.join(",")
                  : mainTicker.symbol,
            },
          };
        }

        // Create widget instance
        templateWidgets.push({
          ...widget,
          id: widgetUniqueId,
          innerTab: tab.id,
          isMinimized,
          originalH,
        });
      }
    }
  }

  if (unresolvedWidgetIds.size > 0) {
    throw new Error(
      `Unable to create app because these widgets are unavailable: ${[
        ...unresolvedWidgetIds,
      ].join(", ")}`,
    );
  }

  if (Object.keys(gridLayout).length > 1 || hasNavigationBar) {
    const widget = getJsonWidget("navigation_bar");
    const tabStorage = Object.values(template.tabs).map((tab) => ({
      id: tab.id,
      name: tab.name,
    }));
    const widgetUniqueId = uuidv4();
    const navigationWidget = {
      ...widget,
      id: widgetUniqueId,
      storage: { tabs: tabStorage },
      innerTab: Object.keys(gridLayout)[0],
    } as Widget;

    templateWidgets.push(navigationWidget);
  }

  // we need to remove widgetIds from groups
  const newGroups = temporaryGroups.map((group) => {
    const { widgetIds, ...restGroup } = group;
    return restGroup;
  });

  if (template.selected_agent) {
    const availableCopilots = await getExternalCopilotHolders();
    const copilot = availableCopilots
      .flatMap((copilot) => copilot.copilots || [])
      .find((c) => [c.id, c.name].some((name) => name === template.selected_agent));

    if (copilot) {
      useCopilotStore.getState().setSelectedCopilot(copilot);
      document.getElementById("expand-copilot-btn")?.click();
      document.getElementById("expand-copilot-mobile-btn")?.click();
    }

    if (template.prompts?.length > 0) {
      setTimeout(() => {
        useThemeStore.getState().setPromptsSuggestionsMenuOpen(true);
      }, 400);
    }
  }

  addTab(
    {
      index: id,
      data: {
        name: tabName,
        templateId,
        type: "template",
        widgets: templateWidgets,
        gridLayout,
        groups: newGroups,
      },
    },
    true,
  );

  if (navigate) navigate(`/app/${id}`);
  return id;
}

export async function openListedApp({
  source,
  items,
  addTab,
  navigate,
  currentDashboard,
}: {
  source: Source | null;
  items: Items;
  addTab: AppState["addTab"];
  navigate?: NavigateFunction;
  currentDashboard?: string;
}) {
  if (!source) return false;
  const template = source.templates?.[0];
  if (!template) return false;

  return await createCustomTemplateTab({
    addTab,
    navigate,
    items,
    template,
    source,
    currentDashboard,
  });
}

export function extractCustomTemplateInfo(templateId = "") {
  const groups = templateId.match(
    /custom-(?<sourceId>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(?<templateName>.+)/,
  )?.groups as { sourceId: string; templateName: string };

  return groups ?? { sourceId: null, templateName: null };
}

export function createChartingTemplateTab({
  addTab,
  navigate = null,
  items,
  defaultTicker = DEFAULT_TICKERS.AAPL,
  currentDashboard = "",
}: {
  addTab: AppState["addTab"];
  navigate?: NavigateFunction;
  items: Items;
  defaultTicker?: Ticker;
  currentDashboard?: string;
}): string | undefined {
  const currentDashboardItem = items?.[currentDashboard];
  const hasZeroWidgets = currentDashboardItem?.data?.widgets?.length === 0;

  const id = hasZeroWidgets ? currentDashboard : uuidv4();

  const groupId = uuidv4();
  const mainTicker = MainTickerByCategory({
    defaultTicker,
    defaultCategory: defaultTicker?.category ?? "equity",
  });

  const color = COLORS[0];

  const newGroups = [
    {
      id: groupId,
      name: "Group 1",
      color,
      value: mainTicker,
      type: "ticker",
    },
  ] as TabData["groups"];

  const gridLayout = { overview: [] } as GridLayout;

  const widgets = TEMPLATES.charting.widgets.map((widget: Partial<Widget | any>) => {
    const { gridData, ...restWidget } = widget as Widget;
    const { i, ...restGridData } = TEMPLATES.charting.tabs.overview.layout.find(
      (layoutItem) => layoutItem.i === widget.widgetId,
    );
    const widgetUniqueId = uuidv4();

    gridLayout.overview.push({
      ...(gridData || {}),
      ...restGridData,
      i: widgetUniqueId,
    });

    return {
      id: widgetUniqueId,
      groupId,
      name: widget.name,
      type: widget.type,
      widgetId: widget.widgetId,
      data: {
        mainTicker,
        secondTickers: [],
      },
      ...restWidget,
    } as Widget;
  });

  addTab(
    {
      index: id,
      data: {
        name: TEMPLATES.charting.name.replace("Template", "Dashboard"),
        templateId: "charting",
        type: "template",
        widgets,
        gridLayout,
        groups: newGroups,
      },
    },
    true,
    mainTicker,
  );
  if (navigate) navigate(`/app/${id}`);

  return id;
}

export function createEquityTemplateTab(
  item,
  {
    addTab,
    navigate,
    items,
    currentDashboard = "",
    defaultTicker = DEFAULT_TICKERS.AAPL,
  }: {
    addTab: AppState["addTab"];
    navigate?: NavigateFunction;
    items: Items;
    currentDashboard?: string;
    defaultTicker?: Ticker;
  },
  innerTab = "overview",
): string | undefined {
  const currentDashboardItem = items?.[currentDashboard];
  const hasZeroWidgets = currentDashboardItem?.data?.widgets?.length === 0;

  const id = hasZeroWidgets ? currentDashboard : uuidv4();
  const mainTicker = MainTickerByCategory({ defaultTicker, defaultCategory: "equity" });

  const groupId = uuidv4();

  const color = COLORS[0];

  const widgets = [];
  const newGroups = [
    {
      id: groupId,
      name: "Group 1",
      color,
      value: mainTicker,
      type: "ticker",
    },
  ] as TabData["groups"];

  const gridLayout = Object.values(TEMPLATES.equity.tabs).reduce(
    (acc, tab) => {
      if (!acc[tab.id]) acc[tab.id] = [];
      return acc;
    },

    {} as Record<string, any>,
  );

  const tabs = getTabs("equity");
  type Tab = (typeof TEMPLATES.equity.tabs)[keyof typeof TEMPLATES.equity.tabs];

  for (const tabId in TEMPLATES.equity.tabs) {
    if (TEMPLATES.equity.tabs.hasOwnProperty(tabId)) {
      const tab = TEMPLATES.equity.tabs[tabId] as Tab;

      for (const layout of tab.layout) {
        const { i: widgetId, ...restGridData } = layout;
        const widget = TEMPLATES.equity.widgets.find((w) => w.widgetId === widgetId);

        if (widget) {
          const { gridData, ...restWidget } = widget;
          if (restGridData) {
            const widgetStorage =
              widget.widgetId === "navigation_bar"
                ? { ...(widget.storage ?? {}), tabs }
                : (widget.storage ?? {});

            const widgetUniqueId = uuidv4();
            gridLayout[tab.id].push({
              ...(gridData || {}),
              ...restGridData,
              i: widgetUniqueId,
            });

            widgets.push({
              id: widgetUniqueId,
              groupId,
              name: widget.name,
              type: widget.type,
              widgetId: widget.widgetId,
              endpoint: widget.endpoint,
              sdkFunc: widget.sdkFunc,
              platformDataFunction: widget.platformDataFunction,
              excelDataFunction: widget.excelDataFunction,
              params: widget.params ?? [],
              innerTab: tab.id, // Set the innerTab to the current tab ID
              ...restWidget,
              storage: widgetStorage,
              data: {
                ...(widget.data ?? {}),
                table: {
                  ...(widget.data?.table ?? {}),
                  transpose: Boolean(widget.data?.table?.transpose),
                },
                mainTicker,
                dataKey: item.dataKey,
              },
            });
          }
        }
      }
    }
  }

  addTab(
    {
      index: id,
      data: {
        name: TEMPLATES.equity.name.replace("Template", "Dashboard"),
        templateId: "equity",
        type: "template",
        widgets,
        gridLayout,
        groups: newGroups,
      },
    },
    true,
    mainTicker,
  );
  if (navigate) navigate(`/app/${id}?tab=${innerTab}`);

  return id;
}

export function createOnBoardingTemplate({
  addTab,
  navigate = null,
}: {
  addTab: AppState["addTab"];
  navigate?: NavigateFunction;
}): string | undefined {
  const id = uuidv4();

  const gridLayout = {} as GridLayout;
  const groups = Onboarding.groups as TabData["groups"];

  const widgets = Onboarding.widgets.map((widget: Partial<Widget | any>) => {
    const { gridData, ...restWidget } = widget as Widget;

    const innerTab = restWidget.innerTab ?? "overview";
    const { i, ...restGridData } = Onboarding.gridLayout[innerTab].find(
      (layoutItem) => layoutItem.i === widget.id,
    );

    const widgetUniqueId = uuidv4();

    if (!gridLayout[innerTab]) gridLayout[innerTab] = [];

    gridLayout[innerTab].push({
      ...(gridData || {}),
      ...restGridData,
      i: widgetUniqueId,
    });

    if (ONBOARDING_STORED_FILES?.[widget.widgetId]) {
      const { urlDev, urlProd } = ONBOARDING_STORED_FILES[widget.widgetId];
      widget.endpoint = {
        ...widget.endpoint,
        url: import.meta.env.DEV ? urlDev : urlProd,
      };
    }

    return {
      ...restWidget,
      id: widgetUniqueId,
      name: widget.name,
      widgetId: widget.widgetId,
      endpoint: widget.endpoint,
      sdkFunc: widget.sdkFunc,
      platformDataFunction: widget.platformDataFunction,
      excelDataFunction: widget.excelDataFunction,
      options: widget.options,
      params: widget.params ?? [],
      data: {
        ...(widget.data ?? {}),
        table: {
          ...(widget.data?.table ?? {}),
          transpose: Boolean(widget.data?.table?.transpose),
        },
      },
      innerTab,
      storage: widget.storage ?? {},
    } as Widget;
  });

  addTab(
    {
      // The name of the dashboard was intentionally changed to `Earnings Update`
      // the `templateId` shouldn't change as it has to do with BE interaction
      index: id,
      data: {
        name: "Earnings Update",
        templateId: "onboarding",
        type: "template",
        widgets,
        gridLayout,
        groups,
      },
    },
    true,
  );
  if (navigate) navigate(`/app/${id}`);

  return id;
}

function getTemplatesToCreate(bundleInfo: DataBundle | null): string[] {
  if (!bundleInfo) {
    // Default templates if no bundle info is provided
    return ["equity", "charting", "equityAnalyst"] as DashboardTypes[];
  }

  const allTemplates = [
    "charting",
    "equityAnalyst",
    "equity",
    "etfTemplate",
    "onboarding",
  ] as DashboardTypes[];

  const { dashboards_at_launch, except_dashboard_templates } = bundleInfo;

  if (dashboards_at_launch) return dashboards_at_launch;

  if (except_dashboard_templates) {
    return allTemplates.filter(
      (template) => !except_dashboard_templates?.includes(template),
    );
  }

  return allTemplates;
}

export function handleTemplatesCreation(
  dataBundleInfo: DataBundle | null,
  defaultTicker: Ticker,
  addTab: AppState["addTab"],
  items: Items,
): string | undefined {
  const templatesToCreate = Array.from(new Set(getTemplatesToCreate(dataBundleInfo)));

  items = getValidItems(items);

  let onboardingId: string | undefined;
  for (const template of templatesToCreate) {
    switch (template) {
      case "equity":
        createEquityTemplateTab(
          { name: defaultTicker.symbol },
          { addTab, navigate: null, items, defaultTicker },
        );
        break;
      case "charting":
        createChartingTemplateTab({ addTab, items });
        break;
      case "onboarding":
        onboardingId = createOnBoardingTemplate({
          addTab,
          navigate: null,
        });
        break;
    }
  }

  saveDashboards();
  return onboardingId;
}
