import cloneDeep from "lodash/cloneDeep";
import isEqualWith from "lodash/isEqualWith";
import isEqual from "lodash.isequal";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import type { SecurityType } from "~/components/Charting/constants";
import { isTableWidgetType } from "~/components/DataConnectors/WidgetsBuilder/utils";
import { convertToReadableLabel } from "~/components/General/Table/AgGridUtils";
import { getStateKey } from "~/components/General/Table/hooks/useUpdateColumnState";
import { getNewQuery, isTruthy } from "~/components/General/Table/utils";
import type {
  GridData,
  GridLayout,
  GroupTypeT,
  ParamDef,
  ParamDefT,
  Ticker,
  WidgetT as Widget,
  WidgetJsonT,
  WidgetT,
} from "~/components/types";
import { getConfig } from "~/lib/runtimeConfig";
import { formatZodIssues } from "~/lib/utils/validateBackend";
import { INDICES } from "~/seeds/randomSeed";
import { formatZodErrorMessage } from "~/utils/zodErrors";
import type { AppState, Group, InnerTab, Item, Items } from "../state/app";
import {
  type ConnectionType,
  useBackendConnectorStore,
} from "../state/backendConnector";
import { useChartingStore } from "../state/charting";
import { useCopilotDataStore } from "../state/copilotData";
import { DEFAULT_TICKERS } from "../types";
import {
  ExternalWidgetSchema,
  InternalWidgetSchema,
  isWidgetVizType,
} from "../types/app";
import { ONBOARDING_STORED_FILES } from "./createTemplates";
import {
  ensureArray,
  extractUUIDFromURL,
  generateGroupingColor,
  generateRandomName,
} from "./utils";
import {
  getJsonWidget,
  getSupportedAssetClasses,
  groupParamOverride,
  isSSRMType,
} from "./widget";
import {
  cleanSearchParams,
  convertHeadersToRecord,
  createParamDefs,
  createWidgetEndpoint,
  createWidgetInitParams,
} from "./widgetParams";

const servicesCloudflareWorkerFF = getConfig().services.cloudflareWorker;

export function checkIfWidgetsHaveMainTickerAndAreTheSame(widgets: Widget[]) {
  let mainTicker: Ticker | undefined;
  let someHaveMainTicker = false;
  let allTheSame = true;
  for (const widget of widgets) {
    if (widget.data?.mainTicker) {
      someHaveMainTicker = true;
      if (mainTicker) {
        if (
          widget.data.mainTicker.id !== mainTicker.id ||
          widget.data.mainTicker.type !== mainTicker.type
        ) {
          allTheSame = false;
        }
      } else {
        mainTicker = widget.data.mainTicker;
      }
    }
  }
  return {
    someHaveMainTicker,
    allTheSame,
    mainTicker,
  };
}

export function createTab(addTab) {
  const id = uuidv4();
  addTab({
    index: id,
    data: {
      name: generateRandomName(),
      type: "custom",
    },
  });
  //navigate(`/app/${id}`);
  setTimeout(() => {
    document.getElementById(`tab-${id}`)?.click();
  }, 100);
}

export function createRootFolder(): Item {
  return {
    index: uuidv4(),
    name: "root",
    isFolder: true,
    isRoot: true,
    children: [],
    data: { name: "root" },
  };
}

const emptyDash = {
  i: "empty-dashboard-cta",
  x: 0,
  y: 2,
  w: 40,
  h: 20,
  isResizable: false,
  isDraggable: false,
};

export function removeDuplicateNavBarWidgets(item: Item) {
  if (!(item?.data?.widgets || item?.isFolder)) return item;

  const navBarWidgets = item.data.widgets.filter(
    (widget) => widget.widgetId === "navigation_bar",
  );

  if (navBarWidgets.length === 0) return item;

  const gridLayout = item.data.gridLayout || {};
  const [firstWidgetId, ...restIds] = navBarWidgets.map((widget) => widget.id);

  item.data.widgets = item.data.widgets.filter(
    (widget) => !restIds.includes(widget.id),
  );

  const wGridData = Object.values(gridLayout)
    .flat()
    .find((l) => l.i === firstWidgetId);

  const tabs = (navBarWidgets?.[0]?.storage?.tabs as InnerTab[]) || [];
  for (const tab of tabs) {
    if (!gridLayout[tab.id]) gridLayout[tab.id] = [];
  }

  // Make sure the innerTab of the nav bar widget is valid
  if (!gridLayout[navBarWidgets[0].innerTab]) {
    navBarWidgets[0].innerTab = tabs?.[0]?.id || "";
  }

  item.data.gridLayout = Object.fromEntries(
    Object.entries(gridLayout).map(([key, value]) => {
      const gridData = value?.find((item) => item.i === firstWidgetId);
      if (!gridData && wGridData) value.unshift({ ...wGridData, static: true });
      if (gridData) gridData.static = true;

      value.sort((a, b) => {
        if (a.i === firstWidgetId) return -1;
        if (b.i === firstWidgetId) return 1;
        return 0;
      });

      const newValue = value.filter(
        (item) => !restIds.includes(item.i) && item.i !== "empty-dashboard-cta",
      );
      if (newValue.length === 1) newValue.push(emptyDash);

      return [key, newValue];
    }),
  );

  return item;
}

function getConnectionType(widgetId: string, sourceName?: string): ConnectionType {
  if (["snowflake", "database", "file"].includes(widgetId?.split("-")[0])) {
    return widgetId?.split("-")[0] as ConnectionType;
  }

  if (sourceName) {
    return "advanced-backend";
  }

  return "single";
}

export function recursiveCleanKeys(data: any) {
  if (Array.isArray(data) || !(typeof data === "object" && isTruthy(data))) return data;

  for (const key in data) {
    let cleanedKey = key;
    if (key.includes("_undefined")) {
      cleanedKey = key.replace(/_undefined/g, "");
      data[cleanedKey] = data[key];
      delete data[key];
    }
    data[cleanedKey] = recursiveCleanKeys(data[cleanedKey]);
  }
  return data;
}

export function getValidItems(items: Items) {
  const rootFolder =
    Object.values(items || {})?.find((item) => item?.isRoot) || createRootFolder();

  const newItems = { [rootFolder?.index]: rootFolder };

  function checkChildren(parent: Item, children: string[]) {
    for (const child of children) {
      if (items[child]?.data?.name && items[child]?.parentId !== parent.index) {
        items[child].parentId = parent.index;
      }

      if (items[child]?.data?.name && typeof items[child]?.data?.name !== "string") {
        items[child].data.name = generateRandomName();
      }

      if (items[child]?.isFolder && items[child]?.children?.length > 0) {
        checkChildren(items[child], items[child].children);
      }

      const childWidgets = items[child]?.data?.widgets || [];
      const hasWidgets = childWidgets?.length > 0;

      if (hasWidgets) {
        items[child].data.widgets = items[child].data.widgets.map((widget) => {
          // makes sure internal widgets have most up-to-date params
          const params = createParamDefs(getJsonWidget(widget));
          if (
            !Array.isArray(widget?.params) ||
            (!widget?.external && params?.length > 0)
          ) {
            widget.params = params;
          }

          widget.storage = recursiveCleanKeys(widget.storage);
          for (const key of ["columnState", "filterModel"]) {
            if (widget?.data?.table?.[key])
              widget.data.table[key] = recursiveCleanKeys(widget.data.table[key]);
          }

          if (widget?.data?.table?.columnsDefs?.length > 0) {
            widget.data.table.columnsDefs = widget.data.table.columnsDefs.map((col) => {
              if (typeof col.renderFn === "string") {
                // @ts-expect-error
                col.renderFn = col.renderFn.split(",");
              }
              return col;
            });
          }

          if (
            typeof widget?.data?.wsRowIdColumn === "string" &&
            !Array.isArray(widget?.data?.wsRowIdColumns)
          ) {
            const { wsRowIdColumn, ...rest } = widget.data;
            rest.wsRowIdColumns = [wsRowIdColumn];
            widget.data = rest;
          }

          // makes sure onboarding widgets have the current dev/prod url
          if (items[child]?.data?.templateId === "onboarding") {
            if (ONBOARDING_STORED_FILES?.[widget?.widgetId]) {
              const { urlDev, urlProd } = ONBOARDING_STORED_FILES[widget.widgetId];
              widget.endpoint = {
                ...widget.endpoint,
                url: import.meta.env.DEV ? urlDev : urlProd,
              };
            }

            return widget;
          }

          if (widget?.external && !widget?.connectionType) {
            const connectionType = getConnectionType(
              widget.widgetId,
              widget.sourceName,
            );

            return { ...widget, connectionType };
          }

          // adds the sourceId to external widgets that have a sourceName
          if (widget?.external && widget?.sourceName && !widget?.sourceId) {
            const sources = useBackendConnectorStore.getState().apiSources;
            const sourceId = sources.find(
              (source) =>
                source.name === widget.sourceName &&
                widget?.endpoint?.url?.includes(source.url),
            )?.id;

            if (sourceId) return { ...widget, sourceId: sourceId };
          }
          return widget;
        });

        if (
          !items[child]?.data?.gridLayout ||
          Array.isArray(items[child]?.data?.gridLayout)
        ) {
          const gridLayout = items[child]?.data?.widgets?.reduce((acc, widget) => {
            if (!widget?.gridData) return acc;
            const key = widget.innerTab || "";

            if (!acc[key]) {
              acc[key] = [];
            }

            acc[key].push(widget.gridData);

            return acc;
          }, {});

          items[child].data.gridLayout = gridLayout;
        }

        items[child].data.storedFileUUIDs = getStoredFileUUIDs(childWidgets);

        removeDuplicateNavBarWidgets(items[child]);
      }

      if (items[child]?.data?.groups?.length > 0) {
        items[child].data.groups = items[child].data.groups.map((g) => {
          // @ts-expect-error
          const { ticker, ...group } = g;

          if (ticker?.symbol && !group?.value) {
            group.value = ticker;
            group.type = "ticker";
          }
          return group;
        });
      }

      if (items[child]?.data?.name && !items[child]?.isFolder) {
        items[child].data.gridLayout = items[child]?.data?.gridLayout || {};

        // if (
        //   hasWidgets &&
        //   Object.keys(gridLayout).length === 2 &&
        //   gridLayout?.[""]?.length > 0
        // ) {
        //   const sortedGrid = { ...gridLayout, "": gridLayout[""] };

        //   const widgetsInGrid = Object.values(sortedGrid).reduce(
        //     (acc, curr) => {
        //       for (const grid of curr) {
        //         acc[grid.i] = grid;
        //       }
        //       return acc;
        //     },
        //     {} as { [key: string]: GridData },
        //   );

        //   const otherTab = Object.keys(gridLayout).find((key) => key !== "");
        //   if (otherTab) {
        //     items[child].data.widgets = items[child].data.widgets.map((widget) => {
        //       widget.innerTab = otherTab;
        //       return widget;
        //     });
        //     gridLayout = { [otherTab]: Object.values(widgetsInGrid) };
        //     items[child].data.currentTab = otherTab;
        //   }
        // }

        // items[child].data.gridLayout = gridLayout;
      }

      const tabWidgetIds = childWidgets?.map((widget) => widget.id) || [];

      // Removes invalid widgets from the gridLayout
      if (tabWidgetIds.length > 0) {
        items[child].data.gridLayout = Object.fromEntries(
          Object.entries(items[child]?.data?.gridLayout || {}).map(([key, value]) => [
            key,
            value?.filter((item) => item.i && tabWidgetIds.includes(item.i)) || [],
          ]),
        );
      }

      newItems[child] = items[child];
    }
  }

  checkChildren(rootFolder, rootFolder?.children || []);

  return newItems;
}

export function deleteItem(itemId: string, items: Items): string[] {
  const itemToDelete = items[itemId];

  if (itemToDelete?.data?.widgets?.length) {
    const uuids = itemToDelete?.data?.widgets?.map((widget) => widget.id);
    useChartingStore.getState().removeTabWidgetsData(uuids);
    useCopilotDataStore.getState()?.removeTabWidgetsData(uuids);
  }

  if (itemToDelete) {
    if (itemToDelete.isFolder) {
      const children = itemToDelete.children;
      const childrenToDelete = children.flatMap((childId) =>
        deleteItem(childId, items),
      );
      return [itemId, ...childrenToDelete];
    }

    return [itemId];
  }

  return [];
}

export function deleteItemFn(items: Items, id: string) {
  const deletedItems = deleteItem(id, items);

  const newItems = Object.fromEntries(
    Object.entries(cloneDeep({ ...items }))
      .filter(([itemId]) => !deletedItems.includes(itemId))
      .map(([itemId, item]) => {
        if (item.isFolder) {
          item.children = item.children.filter(
            (childId) => !deletedItems.includes(childId),
          );
        }
        return [itemId, item];
      }),
  );

  return { newItems, deletedItems };
}

export function unlinkItemFn(items: Items, id: string) {
  if (items[id]?.data?.widgets?.length)
    useChartingStore
      .getState()
      .removeTabWidgetsData(items[id]?.data?.widgets?.map((widget) => widget.id));

  return Object.fromEntries(
    Object.entries(cloneDeep({ ...items })).map(([itemId, item]) => {
      if (item.isFolder) {
        item.children = item.children.filter((childId) => childId !== id);
      }
      return [itemId, item];
    }),
  );
}

export function addDuplicateWidgetToItem(item: Item, widget: Widget) {
  const id = uuidv4();
  const gridData =
    widget.gridData ||
    Object.values(item.data?.gridLayout || {})
      ?.flat()
      ?.find((w) => w.i === widget.id);

  const newWidget = {
    ...(cloneDeep(widget) as Widget),
    id,
    innerTab: widget.innerTab || "",
    groupId: "",
  };

  const gridLayout = updateWidgetGridLayout({
    widget: { ...newWidget, gridData: { ...(gridData || {}), i: id } },
    gridLayout: { ...(item.data?.gridLayout || {}) },
    currentTab: item.data?.currentTab || "",
  });

  const newTab = {
    ...item,
    data: {
      ...item.data,
      numberOfChanges: item.data.numberOfChanges ? item.data.numberOfChanges + 1 : 1,
      lastUpdated: Date.now(),
      widgets: [...item.data.widgets, newWidget],
      gridLayout,
    },
  };

  return removeDuplicateNavBarWidgets(newTab);
}

export function duplicateTabItem(item: Item, rootId?: string, rename = true): Item {
  const { isShared, ...tabToDuplicate } = cloneDeep({ ...item });

  // Create a map to store the old groupId to new groupId mapping
  const groupIdMap = new Map<string, string>();
  const paramGroupIdMap = new Map<string, string>();

  const gridLayout = { ...(tabToDuplicate.data.gridLayout || {}) } as GridLayout;
  const cleanName = tabToDuplicate.data.name.replace(/ \(copy\)$/g, "");

  const duplicatedTab = {
    ...tabToDuplicate,
    index: uuidv4(),
    parentId: rootId,
    data: {
      ...tabToDuplicate.data,
      name: rename ? `${cleanName} (copy)` : tabToDuplicate.data.name,
      numberOfChanges: 0,
      lastUpdated: Date.now(),
      widgets: tabToDuplicate.data.widgets.map((w) => {
        let gridDataIndex = gridLayout?.[w.innerTab || ""]?.findIndex(
          (gridW) => gridW.i === w.id,
        );

        if (gridDataIndex === -1 || gridDataIndex === undefined) {
          gridDataIndex = gridLayout?.overview?.findIndex((gridW) => gridW.i === w.id);
          w.innerTab = "overview";
        }

        const newId = uuidv4();

        // Only update gridLayout if the widget exists in it
        if (gridLayout[w.innerTab]?.[gridDataIndex]) {
          gridLayout[w.innerTab][gridDataIndex].i = newId;
        }

        if (w.widgetId === "navigation_bar") {
          // update old nav bar widget id to new id in all tabs
          for (const tabId in gridLayout) {
            gridLayout[tabId] = gridLayout[tabId].map((grid) => {
              if (grid.i === w.id) grid.i = newId;
              return grid;
            });
          }
        }

        const paramGroupIds = Object.values(w.paramGroups || {}).filter(Boolean);

        if (paramGroupIds.length > 0) {
          const paramGroups = tabToDuplicate.data.groups.filter(
            (g): g is GroupTypeT<"param" | "endpointParam"> =>
              paramGroupIds.includes(g.id) &&
              ["param", "endpointParam"].includes(g.type),
          );

          for (const g of paramGroups) {
            const pGroupId = paramGroupIdMap.get(g.id) ?? uuidv4();

            if (!paramGroupIdMap.has(g.id)) {
              paramGroupIdMap.set(g.id, pGroupId);
            }

            w.paramGroups = addToWidgetParamGroups(w?.paramGroups, {
              ...g,
              id: pGroupId,
            });
          }
        }

        if (!w.groupId) return { ...w, id: newId };

        if (groupIdMap.has(w.groupId)) {
          return {
            ...w,
            id: newId,
            groupId: groupIdMap.get(w.groupId),
          };
        }

        // Generate a new groupId for each widget
        const newGroupId = uuidv4();
        groupIdMap.set(w.groupId, newGroupId);

        return {
          ...w,
          id: newId,
          groupId: newGroupId, // Assign the new groupId to the widget
        };
      }),
      // Create new groups in the duplicated tab
      groups: tabToDuplicate.data.groups.map((g) => {
        const pGroupId = paramGroupIdMap.get(g.id);
        if (["param", "endpointParam"].includes(g.type) && pGroupId) {
          return {
            ...g,
            id: pGroupId,
            color: generateGroupingColor(),
          };
        }

        const newGroupId = groupIdMap.get(g.id);
        return newGroupId
          ? {
              ...g,
              id: newGroupId,
              color: generateGroupingColor(),
            }
          : g;
      }),
    },
  };

  duplicatedTab.data.gridLayout = gridLayout;

  return duplicatedTab;
}

export function needsGroupValueUpdate(widget: Widget, group: Group) {
  if (group?.id === undefined) return false;

  if (group?.type === "endpointParam") {
    const paramDef = getEndpointParamDef(getEndpointParams(widget), group?.groupById);
    const paramName = paramDef?.paramName;
    return widget?.storage?.params?.[paramName] !== group.value;
  }

  if (group?.type === "ticker" && group?.value?.symbol) {
    const supportedTypes = getSupportedAssetClasses(widget.widgetId);
    const category = group?.value?.category ?? widget?.data?.mainTicker?.category;
    const isOptions = supportedTypes.includes("options") && group?.value?.has_options;

    const validTicker =
      [category, "all"].some((type) => supportedTypes.includes(type)) ||
      widget?.external;

    return validTicker || isOptions;
  }

  if (group?.type === "param" && group?.groupById) {
    return widget?.storage?.params?.[group.groupById] !== group.value;
  }

  return false;
}

export function needsGroupValuesUpdate(widget: Widget, groups: Group[]) {
  return groups.some((group) => needsGroupValueUpdate(widget, group));
}

export function updateWidgetGroupValues(widget: Widget, groups: Group[]): Widget {
  return (groups || []).reduce(
    (w, group) => {
      if (group?.id === undefined) return w;

      if (group?.type === "endpointParam") {
        const params = getEndpointParams(w);
        const paramName = getEndpointParamName(params, group?.groupById);
        if (!paramName) return w;

        w.storage = {
          ...(w.storage ?? {}),
          params: {
            ...(w.storage?.params ?? {}),
            [paramName]: group.value,
          },
        };
        return w;
      }

      if (group?.type === "ticker" && group?.value?.symbol) {
        w.data.mainTicker = group?.value;

        const tickerParam = getTickerParamName(w);

        w.storage = {
          ...(w.storage ?? {}),
          params: {
            ...(w.storage?.params ?? {}),
            [tickerParam]: group?.value.symbol,
          },
        };

        if (["watchlist", "grouped_comparisons"].some((id) => id === w.widgetId)) {
          const secondaryTickers = [group?.value, ...(w?.data?.secondaryTickers || [])];

          const tickers = Object.values(
            Object.fromEntries(secondaryTickers.map((t) => [t.symbol, t])),
          );

          w.storage.params.symbol = tickers.map((ticker) => ticker.symbol).join(",");
        }
        return w;
      }

      if (isValidParamOption(w, group)) {
        let paramName = group.groupById;

        if (!widget?.external && group.groupById === "period") {
          paramName = groupParamOverride(group.groupById, w.widgetId);
          const isStatements = w.widgetId === "financial_statements";

          if (isStatements && !["annual", "quarter"].includes(group.value)) return w;

          if (w?.storage?.selectedGroup && isStatements) {
            const selectedGroup = w?.storage?.selectedGroup;
            w.storage[selectedGroup] = {
              ...(w.storage?.[selectedGroup] || {}),
              period: group.value,
            };
          }

          w.storage = {
            ...w.storage,
            period: group.value,
          };
        }

        w.storage = {
          ...w.storage,
          params: {
            ...w.storage?.params,
            [group.groupById]: group.value,
            [paramName]: group.value,
          },
        };

        return w;
      }

      return w;
    },
    { ...widget },
  );
}

export function addToWidgetParamGroups(
  wParamGroups: Widget["paramGroups"],
  group: GroupTypeT<"param" | "endpointParam">,
): Widget["paramGroups"] {
  if (group?.id === undefined) return wParamGroups;

  const paramGroups = {
    ...(wParamGroups ?? {}),
    [group.groupById]: group.id,
  };
  return paramGroups;
}

export function updateWidgetGroupValue(widget: Widget, group: Group) {
  return updateWidgetGroupValues(widget, [group]);
}

export function getGroupLabel(group: Group) {
  if (group?.type === "ticker") return group?.value?.symbol;
  return group?.value;
}

export function getGroupInfo(group: Group, paramDef?: ParamDef) {
  const output = { valueLabel: "", paramLabel: paramDef?.label || paramDef?.paramName };
  if (!group) return output;

  const rawValue = group.type === "ticker" ? group.value?.symbol : group.value;
  if (!rawValue) return { ...output, valueLabel: "" };

  output.valueLabel = ensureArray(rawValue)
    .map((v) => {
      const option = paramDef?.options?.find(
        (item) => String(item.value) === String(v),
      );
      return option?.label ?? String(v);
    })
    .join(", ");

  return output;
}

export function getEndpointParamRequestArgs(
  widget: Widget,
  param: ParamDefT<"endpoint">,
  currentParams: Record<string, any>,
) {
  const { headers, newParams } = convertHeadersToRecord(widget.endpoint?.headers ?? {});

  for (const [key, value] of Object.entries(param.optionsParams ?? {})) {
    if (value?.toString()?.startsWith("$")) {
      newParams[key] = currentParams?.[value.slice(1)];
    } else newParams[key] = value;
  }

  const url = cleanSearchParams(param.optionsEndpoint, newParams);
  const reqInit = { headers } as RequestInit;
  if (param.query) {
    const query = getNewQuery(param.query, currentParams);
    reqInit.method = "POST";
    reqInit.headers = { "Content-Type": "application/json", ...headers };
    reqInit.body = JSON.stringify({ query });
  }

  return { url, reqInit };
}

export function getEndpointParams(widget: Partial<Widget>): ParamDefT<"endpoint">[] {
  const params = [
    ...createParamDefs({ params: widget?.params ?? [] }),
    ...createParamDefs({ params: widget?.storage?.sqlParamDefs ?? [] }),
  ];
  return params.filter(
    (param): param is ParamDefT<"endpoint"> => param?.type === "endpoint",
  );
}

export function getEndpointParamDef(params: ParamDef[], paramId: string) {
  return params?.find(
    (param): param is ParamDefT<"endpoint"> =>
      param.type === "endpoint" &&
      (param.groupById === paramId || param.paramName === paramId),
  );
}

export function getEndpointParamName(params: ParamDef[], paramId: string) {
  const param = params?.find(
    (param) =>
      param.type === "endpoint" &&
      (param.groupById === paramId || param.paramName === paramId),
  );
  return param?.paramName;
}

export function getWidgetGroupValue(widget: Widget, group: Group) {
  if (group?.id === undefined) return null;

  if (group?.type === "endpointParam") {
    const params = getEndpointParams(widget);
    const paramName = getEndpointParamName(params, group?.groupById);
    return widget?.storage?.params?.[paramName];
  }

  if (group?.type === "ticker") {
    return widget?.data?.mainTicker;
  }

  if (group?.type === "param" && group?.groupById) {
    return widget?.storage?.params?.[group.groupById];
  }

  return null;
}

type EndpointParamGroup = GroupTypeT<"endpointParam">;

type EndpointParamDependency = {
  widget: Widget;
  sourceParam: ParamDefT<"endpoint">;
  dependentParam: ParamDefT<"endpoint">;
  dependentGroupId: string;
};

type EndpointParamOptionsRequestCache = Map<string, Promise<unknown[]>>;

const _getEndpointParamOptionValue = (option: unknown): string | undefined => {
  if (typeof option === "string") return option;
  if (!option || typeof option !== "object") return undefined;

  const value = (option as { value?: unknown }).value;
  if (value === undefined || value === null) return undefined;
  return value.toString();
};

const _getEndpointParamOptionValues = (options: unknown[]): Set<string> => {
  return new Set(
    options
      .map(_getEndpointParamOptionValue)
      .filter((value): value is string => !!value),
  );
};

const _getSelectedEndpointParamOptionValues = (options: unknown[]): string[] => {
  return options
    .filter(
      (option) =>
        !!option &&
        typeof option === "object" &&
        (option as { selected?: unknown }).selected === true,
    )
    .map(_getEndpointParamOptionValue)
    .filter((value): value is string => !!value);
};

const _getEndpointGroupValues = (value: EndpointParamGroup["value"]): string[] => {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined && item !== null && item !== "")
      .map((item) => item.toString());
  }
  if (value === undefined || value === null || value === "") return [];
  return [value.toString()];
};

const _endpointParamDependsOn = (param: ParamDefT<"endpoint">, paramName: string) => {
  return Object.values(param.optionsParams ?? {}).some(
    (value) => value === `$${paramName}`,
  );
};

function _getWidgetParamsWithGroupMap(widget: Widget, groupsMap: Map<string, Group>) {
  const endpointParams = getEndpointParams(widget);
  const currentParams = { ...(widget.storage?.params ?? {}) };

  for (const [groupById, groupId] of Object.entries(widget.paramGroups ?? {})) {
    const group = groupsMap.get(groupId);
    if (!group) continue;

    if (group.type === "endpointParam") {
      const paramName = getEndpointParamName(endpointParams, groupById);
      if (paramName) currentParams[paramName] = group.value;
      continue;
    }

    if (group.type === "param") {
      currentParams[group.groupById] = group.value;
    }
  }

  return currentParams;
}

function _getEndpointParamRequestCacheKey(url: string, reqInit: RequestInit) {
  const headers =
    reqInit.headers instanceof Headers
      ? Object.fromEntries(reqInit.headers.entries())
      : (reqInit.headers ?? {});

  return JSON.stringify({
    url,
    method: reqInit.method ?? "GET",
    headers,
    body: reqInit.body ?? "",
  });
}

async function _fetchEndpointParamOptions(
  widget: Widget,
  param: ParamDefT<"endpoint">,
  currentParams: Record<string, any>,
  requestCache?: EndpointParamOptionsRequestCache,
) {
  if (!param.optionsEndpoint) return [];

  const { url, reqInit } = getEndpointParamRequestArgs(widget, param, currentParams);
  const cacheKey = _getEndpointParamRequestCacheKey(url, reqInit);
  const cachedRequest = requestCache?.get(cacheKey);
  if (cachedRequest) return cachedRequest;

  const request = (async () => {
    const response = await fetch(url, reqInit);
    if (!response.ok) return [];

    const data = await response.json();
    if (param.query) return data?.rowData ?? [];
    return Array.isArray(data) ? data : [];
  })().catch((error) => {
    requestCache?.delete(cacheKey);
    throw error;
  });

  requestCache?.set(cacheKey, request);
  return request;
}

function _buildEndpointParamDependencyMap(
  widgets: Widget[],
  groupMap: Map<string, Group>,
) {
  const dependencyMap = new Map<string, EndpointParamDependency[]>();
  const seenDependentGroupIdsBySource = new Map<string, Set<string>>();

  for (const widget of widgets) {
    const endpointParams = getEndpointParams(widget);

    for (const sourceParam of endpointParams) {
      const sourceGroupById = sourceParam.groupById;
      if (!sourceGroupById) continue;

      const sourceGroupId = widget.paramGroups?.[sourceGroupById];
      if (!sourceGroupId) continue;

      const sourceGroup = groupMap.get(sourceGroupId);
      if (sourceGroup?.type !== "endpointParam") continue;

      for (const dependentParam of endpointParams) {
        const dependentGroupById = dependentParam.groupById;
        if (!dependentGroupById || dependentGroupById === sourceGroupById) continue;
        if (!_endpointParamDependsOn(dependentParam, sourceParam.paramName)) continue;

        const dependentGroupId = widget.paramGroups?.[dependentGroupById];
        if (!dependentGroupId) continue;

        const seenDependentGroupIds =
          seenDependentGroupIdsBySource.get(sourceGroupId) ?? new Set<string>();
        if (seenDependentGroupIds.has(dependentGroupId)) continue;
        seenDependentGroupIds.add(dependentGroupId);
        seenDependentGroupIdsBySource.set(sourceGroupId, seenDependentGroupIds);

        const dependencies = dependencyMap.get(sourceGroupId) ?? [];
        dependencies.push({
          widget,
          sourceParam,
          dependentParam,
          dependentGroupId,
        });
        dependencyMap.set(sourceGroupId, dependencies);
      }
    }
  }

  return dependencyMap;
}

export async function updateDependentEndpointParamGroups(
  tab: Item,
  sourceGroup: Group,
  updateGroup: AppState["updateGroup"],
) {
  if (sourceGroup?.type !== "endpointParam") return;
  if (!tab?.data) return;

  const tabId = tab.index;
  const groups = tab.data.groups ?? [];
  const groupMap = new Map(groups.map((group) => [group.id, group]));
  groupMap.set(sourceGroup.id, sourceGroup);

  const dependencyMap = _buildEndpointParamDependencyMap(
    tab.data.widgets ?? [],
    groupMap,
  );
  const requestCache: EndpointParamOptionsRequestCache = new Map();
  const processedSourceGroupIds = new Set<string>();

  const updateEndpointGroup = (group: EndpointParamGroup) => {
    groupMap.set(group.id, group);
    const index = groups.findIndex((item) => item.id === group.id);
    if (index !== -1) groups[index] = group;
    updateGroup(tabId, group.id, group, false);
  };

  const updateDependentsForGroup = async (currentSourceGroup: EndpointParamGroup) => {
    if (processedSourceGroupIds.has(currentSourceGroup.id)) return;
    processedSourceGroupIds.add(currentSourceGroup.id);

    for (const dependency of dependencyMap.get(currentSourceGroup.id) ?? []) {
      try {
        const currentParams = _getWidgetParamsWithGroupMap(dependency.widget, groupMap);
        currentParams[dependency.sourceParam.paramName] = currentSourceGroup.value;
        const options = await _fetchEndpointParamOptions(
          dependency.widget,
          dependency.dependentParam,
          {
            ...currentParams,
            [dependency.dependentParam.paramName]: "",
          },
          requestCache,
        );

        const dependentGroup = groupMap.get(dependency.dependentGroupId);
        if (dependentGroup?.type !== "endpointParam") continue;

        const groupValues = _getEndpointGroupValues(dependentGroup.value);
        const optionValues = _getEndpointParamOptionValues(options);
        const hasValidValue = groupValues.some((value) => optionValues.has(value));
        if (hasValidValue) continue;

        const selectedValues = _getSelectedEndpointParamOptionValues(options);
        if (groupValues.length === 0 && selectedValues.length === 0) {
          await updateDependentsForGroup(dependentGroup);
          continue;
        }

        const nextValue: EndpointParamGroup["value"] = dependency.dependentParam
          .multiSelect
          ? selectedValues
          : (selectedValues[0] ?? "");
        const updatedGroup: EndpointParamGroup = {
          ...dependentGroup,
          value: nextValue,
        };
        updateEndpointGroup(updatedGroup);
        await updateDependentsForGroup(updatedGroup);
      } catch (error) {
        console.error("Failed to cascade endpoint parameter group", error);
      }
    }
  };

  await updateDependentsForGroup(sourceGroup);
}

export function isValidParamOption(
  widget: Widget,
  group: Group,
): group is GroupTypeT<"param"> {
  if (group?.type === "param" && group?.groupById) {
    const groupValue = group?.value?.toString();
    const paramName = groupParamOverride(group.groupById, widget.widgetId);
    const options = createParamDefs({ params: widget?.params ?? [] }).find(
      (param) => param.paramName === paramName,
    )?.options;

    return (
      options?.length === 0 ||
      !!options?.find((option) => groupValue?.includes(option.value?.toString()))
    );
  }

  return false;
}

export function getTickerParamName(widget: Partial<Widget | WidgetJsonT>) {
  const isEconomyGroup = widget?.data?.mainTicker?.category === "country";
  const param = widget?.params?.find((param) => param?.type === "ticker");
  return param?.paramName || (isEconomyGroup ? "country" : null);
}

export function getCellOnClickParams(
  widget: Partial<Widget>,
  includeForceUpdate = true,
) {
  return (widget?.data?.table?.columnsDefs || [])
    .filter(
      (col) =>
        col?.renderFn?.includes("cellOnClick") &&
        col?.renderFnParams?.actionType === "groupBy" &&
        (includeForceUpdate || !col?.renderFnParams?.groupBy?.forceUpdate),
    )
    .map((col) => col?.renderFnParams?.groupBy?.paramName)
    .filter(Boolean);
}

export function getEndpointParamGroupByIds(widget: Partial<Widget>) {
  return getEndpointParams(widget as Widget)?.reduce((acc, p) => {
    acc[p.groupById] = p?.paramName;
    return acc;
  }, {});
}

function customizer(value: any, other: any, indexOrKey: string | undefined) {
  // ignore stateKey when comparing widgets for changes
  if (indexOrKey === "storage") {
    const stateKey = getStateKey(value, value?.isPivotMode);
    const otherStateKey = getStateKey(other, other?.isPivotMode);
    if (stateKey === otherStateKey) {
      const { [stateKey]: _, ...restStorage } = value || {};
      const { [otherStateKey]: __, ...restOtherStorage } = other || {};
      return isEqual(restStorage, restOtherStorage);
    }
  }
}
export function updateWidgetInItem(item: Item, widget: Widget) {
  const newItem = { ...item };

  if (!newItem.isFolder && newItem.data) {
    let hasChanges = false;
    newItem.data.widgets = newItem.data.widgets.map((w) => {
      if (w.id !== widget.id) return w;

      hasChanges = !w.isNew && !isEqualWith(w, widget, customizer);
      const { isNew, ...updatedWidget } = { ...w, ...widget };
      return updatedWidget;
    });

    if (hasChanges) {
      const numberOfChanges = newItem?.data?.numberOfChanges ?? 0;
      newItem.data.numberOfChanges = numberOfChanges + 1;
      newItem.data.lastUpdated = Date.now();
      newItem.updated_date = new Date().toISOString();
    }
  }
  return newItem;
}

export function removeWidgetAndReposition(
  widgets: Widget[],
  widgetId: string,
  tabCols = 40,
) {
  // Find the index of the widget to remove
  const indexToRemove = widgets.findIndex((widget) => widget.id === widgetId);

  if (indexToRemove === -1) {
    // Widget not found, return the original list
    return widgets;
  }

  // Remove the widget from the list
  const newWidgets = [...widgets];
  newWidgets.splice(indexToRemove, 1);

  // Sort widgets based on their y position
  newWidgets.sort((a, b) => a.gridData.y - b.gridData.y);

  let currentY = 0;

  // Iterate through each widget and update its position
  for (const widget of newWidgets) {
    if (widget.gridData.y > currentY) {
      // Update widget position if there's a gap
      widget.gridData.x = 0;
      widget.gridData.y = currentY;
    }

    // Check if there's space to the right for the widget
    if (widget.gridData.x + widget.gridData.w <= tabCols) {
      currentY = widget.gridData.y;
      widget.gridData.x = currentY + widget.gridData.h;
    } else {
      // If not enough space, move to the next row
      currentY += 1;
      widget.gridData.x = 0;
      widget.gridData.y = currentY;
    }
  }

  return newWidgets;
}

export function getGridData(
  lastWidgetGridData?: Partial<GridData>,
  widgetGridData: Partial<GridData> = {
    w: 20,
    h: 10,
  },
  options: { tabCols?: number; keepXY?: boolean } = {},
) {
  const { tabCols = 40, keepXY = false } = options;
  const isMinimized = widgetGridData?.h === 1;

  const gridData: GridData = {
    ...widgetGridData,
    w: widgetGridData.w,
    h: widgetGridData.h,
    x: 0,
    y: 0,
    minH: 4,
    minW: 8,
  };

  if (keepXY) {
    gridData.x = widgetGridData.x || 0;
    gridData.y = widgetGridData.y || 0;
  }

  if (widgetGridData.minW) {
    gridData.minW = widgetGridData.minW;
  }

  if (widgetGridData.minH) {
    gridData.minH = Math.min(
      widgetGridData.minH,
      widgetGridData.maxH || Number.POSITIVE_INFINITY,
    );
  }

  if (widgetGridData.maxW) {
    gridData.maxW = Math.max(widgetGridData.maxW, widgetGridData.minW || 0);
  }

  if (widgetGridData.maxH) {
    gridData.maxH = Math.max(widgetGridData.maxH, widgetGridData.minH || 0);
  }

  gridData.w = Math.max(gridData.minW, gridData.w);
  gridData.h = isMinimized ? gridData.h : Math.max(gridData.minH, gridData.h);

  if (lastWidgetGridData) {
    const {
      w: lastWidgetCols,
      h: lastWidgetRows,
      x: lastWidgetX,
      y: lastWidgetY,
    } = lastWidgetGridData;

    const ensuredValidY = Number.isFinite(lastWidgetY) ? lastWidgetY : 0;

    // Check if there's enough space to the right of the last widget
    if (lastWidgetX + lastWidgetCols + widgetGridData.w <= tabCols) {
      gridData.x = lastWidgetX + lastWidgetCols;
      gridData.y = ensuredValidY;
    } else {
      // If not enough space, place the new widget below the last widget
      gridData.x = 0;
      gridData.y = ensuredValidY + lastWidgetRows;
    }
  }

  return gridData;
}

export function getInnerTabsGridLayout(gridLayout: GridLayout) {
  return Object.fromEntries(
    Object.entries(gridLayout ?? {}).filter(([key, value]) =>
      [key !== "", value?.length > 0].every(Boolean),
    ),
  );
}

/**
 * Resolves the `tab` search param a dashboard route should be showing.
 * Returns `null` when the current URL already matches, so the caller never issues a
 * navigation that leaves the URL unchanged.
 */
export function resolveInnerTabParams(props: {
  gridLayout: GridLayout;
  currentTab: string;
  lastInnerTab: string | undefined;
  searchParams: URLSearchParams;
}) {
  const { gridLayout, currentTab, lastInnerTab, searchParams } = props;

  const filtered = getInnerTabsGridLayout(gridLayout);
  const innerTabs = Object.keys(filtered);
  const nextParams = new URLSearchParams(searchParams);

  if (gridLayout && !(currentTab in gridLayout)) nextParams.delete("tab");

  if (innerTabs.length !== 0) {
    const preferred =
      lastInnerTab && filtered[lastInnerTab] ? lastInnerTab : innerTabs[0];
    nextParams.set("tab", preferred);
  }

  return nextParams.toString() === searchParams.toString() ? null : nextParams;
}

export function getStoredFileUUIDs(widgets: Widget[]) {
  const storedFileUUIDs = new Set<string>();

  for (const widget of widgets) {
    if (widget?.connectionType === "file") {
      const fileUUID = extractUUIDFromURL(widget?.endpoint?.url);
      if (fileUUID) storedFileUUIDs.add(fileUUID);
    }
  }

  return Array.from(storedFileUUIDs);
}

export type UpdateWidgetGridLayoutParams = {
  widget: WidgetT | WidgetJsonT;
  gridLayout: GridLayout;
  lastWidgetGridData?: Partial<GridData>;
  currentTab?: string;
  removeWidget?: boolean;
  ignoreLastWidgetGridData?: boolean;
  tabCols?: number;
  tabWidgets?: (WidgetT | WidgetJsonT)[];
};

export function updateWidgetGridLayout(params: UpdateWidgetGridLayoutParams) {
  const {
    widget,
    gridLayout,
    lastWidgetGridData = null,
    currentTab = "overview",
    removeWidget = false,
    ignoreLastWidgetGridData = false,
    tabCols = 40,
    tabWidgets = [],
  } = params;

  const isNavigationBar = widget?.widgetId === "navigation_bar";
  const tabWidgetIds = tabWidgets.map((widget) => widget.id);

  if (removeWidget) {
    const widgetIds = tabWidgetIds.filter((id) => id !== widget.id);
    return Object.fromEntries(
      Object.entries(gridLayout)
        .map(([key, value]) => [
          key,
          value.filter((item) => widgetIds.includes(item.i)),
        ])
        .filter(([_key, value]) => value.length > 0),
    );
  }

  const layoutKey = widget.innerTab || currentTab || "";
  const currentTabLayout = (gridLayout[layoutKey] || []).filter(
    (item) => item.i !== "empty-dashboard-cta",
  );

  const lastWidget =
    currentTabLayout?.reduce(
      (prev, current) => {
        if (prev.i === "empty-dashboard-cta") return current;
        if (current.i === "empty-dashboard-cta") return prev;
        return prev.y > current.y
          ? prev
          : prev.y === current.y
            ? prev.x > current.x
              ? prev
              : current
            : current;
      },
      { x: 0, y: 0, w: 0, h: 0 },
    ) || null;

  const widgetGridData = { y: 0, x: 0, w: 40, h: 10, ...(widget?.gridData ?? {}) };

  const gridData = getGridData(lastWidgetGridData || lastWidget, widgetGridData, {
    tabCols,
  });

  const finalGridData = ignoreLastWidgetGridData ? widgetGridData : gridData;
  finalGridData.i = widget.id;
  if (isNavigationBar && !ignoreLastWidgetGridData) finalGridData.y = 0;

  // if the widget is already in the layout, update its gridData and layoutKey if needed
  for (const key in gridLayout) {
    for (const w of gridLayout[key]) {
      if (w.i === widget.id && layoutKey !== key) {
        gridLayout[key] = gridLayout[key].filter((item) => item.i !== widget.id);
        gridLayout[layoutKey] = [...(gridLayout[layoutKey] || []), finalGridData];

        return gridLayout;
      }
    }
  }

  gridLayout[layoutKey] = Array.from(new Set([...currentTabLayout, finalGridData]));

  return gridLayout;
}

type MainTickerByCategoryParams = {
  widget?: (Widget | WidgetJsonT) & { dependsOn?: string[] };
  defaultTicker?: Ticker;
  defaultCategory?: Ticker["category"];
};

export function MainTickerByCategory(props: MainTickerByCategoryParams): Ticker {
  const { widget, defaultTicker = DEFAULT_TICKERS.AAPL, defaultCategory } = props;
  const mainTicker = widget?.data?.mainTicker || defaultTicker;

  const widgetTypes = getSupportedAssetClasses(widget?.widgetId);
  const hasOptions = widgetTypes.includes("options") && mainTicker?.has_options;

  const supportedTypes = widgetTypes?.length
    ? widgetTypes
    : [
        widget?.defaultAssetClass,
        widget?.category?.toLowerCase(),
        defaultCategory,
        defaultTicker?.category,
      ];

  const tickerCategories = {
    etf: DEFAULT_TICKERS.SPY,
    equity: DEFAULT_TICKERS.AAPL,
    stock: DEFAULT_TICKERS.AAPL,
    [defaultTicker?.category]: defaultTicker,
    all: mainTicker,
    [mainTicker?.category]: mainTicker,
  };

  if (hasOptions) {
    return widget?.data?.mainTicker || defaultTicker;
  }

  return (
    supportedTypes
      .map(
        (assetClass) =>
          tickerCategories?.[widget?.defaultAssetClass] ||
          tickerCategories?.[assetClass] ||
          tickerCategories?.[defaultCategory],
      )
      .find((ticker) => ticker) || tickerCategories.all
  );
}

export function getWidgetData(params: {
  widget: (WidgetT | WidgetJsonT) & { dependsOn?: string[] };
  defaultTicker?: Ticker;
}): Widget {
  const { widget, defaultTicker = DEFAULT_TICKERS.AAPL } = params;

  const mainTicker = MainTickerByCategory({ widget, defaultTicker });

  widget.params = createParamDefs(widget);
  widget.storage = widget.storage || {};
  widget.storage.params = widget?.storage?.params || {};

  const tickerParam = getTickerParamName(widget);

  if (widget.widgetId === "clock" && !widget.storage?.content) {
    widget.storage = {
      ...widget.storage,
      timezones: ["America/New_York"],
    };
  }

  if (widget.widgetId === "xml_viewer" && !widget.data?.html) {
    const prompt = window.prompt("Enter URL");
    widget.data = {
      ...widget.data,
      html: servicesCloudflareWorkerFF ? `https://openbbrss.com/${prompt}` : prompt,
    };
  }

  // if (widget.widgetId === "rss_viewer" && !widget?.storage?.feeds?.length) {
  //   widget.storage = {
  //     ...widget.storage,
  //     feeds: RSS_FEEDS,
  //   };
  // }

  // @ts-expect-error
  if (!widget.external && widget.widgetId === "html_widget") {
    const prompt = window.prompt("Enter HTML");
    widget.data = {
      ...widget.data,
      html: prompt || "<h1>Enter HTML</h1>",
    };
  }

  if (widget.widgetId === "rich_note") {
    widget.storage = {
      ...widget.storage,
      html: widget.storage?.html || widget.data?.html || "",
      hideControls: widget.data?.hideControls,
    };
  }

  if (widget?.params?.length > 0) {
    const initialParams = createWidgetInitParams(widget, mainTicker);

    widget.storage = { ...widget.storage, params: initialParams };
  }

  // TODO: refactor this to be more generic, for example if widget.single or widget.multiple
  // const IGNORE_MAIN_TICKER_IDS = ["currency_snapshot"];
  if (
    !(widget.data?.mainTicker || widget.widgetId === "currency_snapshot") &&
    widget.dependsOn?.includes("mainTicker") &&
    tickerParam
  ) {
    widget.data = {
      ...widget.data,
      mainTicker,
    };
    widget.storage = {
      ...widget.storage,
      params: { ...widget.storage.params, [tickerParam]: mainTicker.symbol },
    };
  }

  if (widget?.endpoint || widget?.sdkFunc) {
    widget.data = {
      ...widget.data,
      table: {
        ...widget.data?.table,
        transpose: widget?.data?.table?.transpose,
      },
    };
  }

  if (widget.type === "table" && widget.data?.table?.enableCharts === undefined) {
    widget.data = {
      ...widget.data,
      table: {
        ...widget.data?.table,
        enableCharts: true,
      },
    };
  }
  const chartView = widget?.data?.table?.chartView;
  const storageChartView = widget.storage?.chartView;
  const needsChartView =
    widget?.external && isTableWidgetType(widget.type ?? widget.defaultViz);
  const shouldHydrateChartView =
    (chartView !== undefined || needsChartView) &&
    chartView?.enabled !== false &&
    (storageChartView === undefined ||
      storageChartView.enabled === undefined ||
      storageChartView.chartType === undefined);

  if (shouldHydrateChartView) {
    widget.storage = {
      ...widget.storage,
      chartSettingsOpen: widget.storage?.chartSettingsOpen ?? false,
      chartView: {
        ...storageChartView,
        enabled: storageChartView?.enabled ?? Boolean(chartView?.enabled),
        chartType: storageChartView?.chartType || chartView?.chartType || "line",
      },
    };

    for (const key of ["chartMiniChartEnabled", "chartNavigatorEnabled"]) {
      if (chartView?.[key]) widget.storage[key] = true;
    }

    if (chartView?.ignoreCellRange) {
      widget.storage = {
        ...widget.storage,
        ignoreCellRange: true,
      };
    }
  }

  if (widget.dataKey) {
    widget.data = {
      ...widget.data,
      dataKey: widget.dataKey,
    };
  }

  if (widget.data?.table?.transpose) {
    widget.storage = {
      ...widget.storage,
      transpose: true,
    };
  }

  if (widget.widgetId === "financial_statements") {
    widget.storage = {
      selectedGroup: "income_statement",
      balance_sheet: {
        period: "annual",
        transpose: true,
      },
      income_statement: {
        period: "annual",
        transpose: true,
      },
      cash_flow_statement: {
        period: "annual",
        transpose: true,
      },
      ...widget.storage,
    };
    widget.storage = {
      ...widget.storage,
      params: { symbol: mainTicker.symbol, period: "annual" },
    };
  }

  if (widget.widgetId === "grouped_comparison") {
    if (!widget.data?.mainTicker) {
      widget.data = {
        ...widget.data,
        mainTicker: mainTicker,
      };
    }
    widget.storage = { ...widget.storage, params: { symbol: mainTicker.symbol } };
  }

  // @ts-expect-error
  if (widget.widgetId === "watchlist" || widget.widgetId === "peers_list") {
    if (!widget.data?.secondaryTickers) {
      const secondaryTickers = {
        [mainTicker.symbol]: mainTicker,
        AAPL: DEFAULT_TICKERS.AAPL,
        MSFT: DEFAULT_TICKERS.MSFT,
        NVDA: DEFAULT_TICKERS.NVDA,
      };

      widget.data = {
        ...widget.data,
        mainTicker: mainTicker,
        secondaryTickers: Object.values(secondaryTickers) as Ticker[],
      };
      widget.storage = {
        ...widget.storage,
        params: { symbol: Object.keys(secondaryTickers).join(",") },
      };
    }
  }
  if (widget.widgetId === "market_indices") {
    widget.storage = {
      ...widget.storage,
      storage: INDICES as SecurityType[],
    };
  }

  if (
    (widget.widgetId === "ticker_information" ||
      (widget.widgetId === "charting" && !widget?.endpoint)) &&
    !widget.data?.mainTicker
  ) {
    widget.data = {
      ...widget.data,
      mainTicker: mainTicker,
    };
    widget.storage = { ...widget.storage, params: { symbol: mainTicker.symbol } };
  }

  if (widget.widgetId === "navigation_bar") {
    const defaultTab = { id: "overview", name: "Overview" };
    const innerTab = widget.innerTab || "overview";
    widget.innerTab = innerTab;

    // Fixes disappearing widgets when adding navigation bar
    // to custom backend apps with innerTab defined
    widget.storage = {
      ...widget.storage,
      tabs: widget.storage?.tabs || [
        innerTab === "overview"
          ? defaultTab
          : { id: innerTab, name: convertToReadableLabel(innerTab) },
      ],
    };
  }

  if (widget.type === "advanced_charting") {
    widget.data = {
      ...widget.data,
      mainTicker: {
        symbol: widget.data?.defaultSymbol,
        type: "stock",
        category: "crypto",
        id: widget.data?.defaultSymbol,
      },
    };
  }

  if (
    widget.dependsOn?.includes("mainTicker") &&
    !widget?.storage?.params?.[tickerParam]
  ) {
    widget.data = { ...widget.data, mainTicker };
    widget.storage.params[tickerParam] = mainTicker.symbol;
  }

  if (["revenue_per_geography", "revenue_per_bus_line"].includes(widget.widgetId)) {
    widget.storage = {
      period: "annual",
      params: {
        period: "annual",
        ...(widget.storage?.params || {}),
      },
      ...widget.storage,
    };
  }

  if (widget?.data?.mainTicker === null) {
    widget.data.mainTicker = undefined;
  }

  const finalWidgetData: Partial<Widget> = {
    id: widget.id || uuidv4(),
    groupId: widget.groupId ?? "",
    widgetId: widget.widgetId,
    name: widget.name ?? "", // IMPROVE: remove name if not needed (all but single news, etc)
    external: widget.external,
    innerTab: widget.innerTab ?? "",
    storage: widget.storage,
    params: widget.params,
    description: widget.description ?? "",
    data: widget.data,
    staleTime: widget.staleTime,
    refetchInterval: widget.refetchInterval,
    dataUpdateDisplay: widget.dataUpdateDisplay,
    runButton: widget?.runButton === true,
    showTitle: widget?.showTitle !== false,
    exportable: widget?.exportable !== false,
    disableRetrievalForCopilot: widget?.disableRetrievalForCopilot,
  };

  if (isWidgetVizType(widget.type)) {
    finalWidgetData.type = widget.type;
  }

  if (widget.defaultViz) {
    finalWidgetData.type = widget.defaultViz;
  }

  if (finalWidgetData.type === "file_viewer" && widget?.fileEndpoint) {
    finalWidgetData.fileEndpoint = widget.fileEndpoint;
  }

  const isSSRMWidget = isSSRMType(widget.type);
  if (widget.data?.table?.enableAdvanced !== undefined || isSSRMWidget) {
    finalWidgetData.storage = {
      ...finalWidgetData.storage,
      // An explicit false in the widget definition wins over the SSRM default
      enableAdvanced: widget.data?.table?.enableAdvanced ?? true,
      ...(widget.type === "ssrm_advanced" ? { ssrmDisabled: true } : {}),
    };
  }

  if (widget.data?.table?.enableFormulas) {
    finalWidgetData.storage = {
      ...finalWidgetData.storage,
      enableFormulas: true,
    };
  }

  if (widget.external) {
    const optionalSourceKeys = [
      "source",
      "sourceId",
      "sourceName",
      "connectionType",
      "sourceDatabase",
      "isSharedWidget",
      "category",
      "subCategory",
      "raw",
    ];
    for (const key of optionalSourceKeys) {
      if (widget[key]) {
        finalWidgetData[key] = widget[key];
      }
    }
    if (widget.endpoint) {
      finalWidgetData.endpoint = createWidgetEndpoint(
        widget.endpoint,
        widget?.endpointHeaders || [],
      );
    }

    if (widget.type === "ssrm_advanced" || widget.type === "omni") {
      for (const key of ["schemaName"]) {
        if (widget[key]) {
          finalWidgetData[key] = widget[key];
        }
      }
    }

    const uniqueParam = widget?.params?.find((param) => param.type === "ticker");

    if (uniqueParam?.type === "ticker") {
      finalWidgetData.storage.params[uniqueParam.paramName] = mainTicker.symbol;
      finalWidgetData.data = {
        ...finalWidgetData.data,
        mainTicker,
      };
    }

    if (
      widget.type === "live_grid" &&
      (widget.wsEndpoint || widget?.data?.wsRowIdColumns || widget?.data?.wsRowIdColumn)
    ) {
      finalWidgetData.wsEndpoint = widget.wsEndpoint;
      const { wsRowIdColumns, wsRowIdColumn } = widget.data || {};
      Object.assign(finalWidgetData.data, { wsRowIdColumns, wsRowIdColumn });
    }

    if (
      widget.connectionType === "advanced-backend" &&
      getJsonWidget(widget.widgetId) !== null
    ) {
      finalWidgetData.widgetId = `${widget.sourceName}-${widget.widgetId}`;
    }

    if (import.meta.env.DEV) console.log(widget, finalWidgetData);
  }

  if (!widget.external) {
    if (widget.data?.mainTicker?.[tickerParam]) {
      finalWidgetData.data = {
        ...finalWidgetData.data,
        mainTicker: widget.data.mainTicker,
      };
    }
    if (widget.data?.secondaryTickers) {
      finalWidgetData.data = {
        ...finalWidgetData.data,
        secondaryTickers: widget.data.secondaryTickers,
      };
    }

    if (Array.isArray(widget?.data?.table?.period)) {
      finalWidgetData.storage = {
        period: widget.data.table.period[0],
        ...finalWidgetData.storage,
        params: {
          period: widget.data.table.period[0],
          ...finalWidgetData.storage?.params,
        },
      };
    }
  }

  if (finalWidgetData.widgetId === "currency_snapshot") {
    finalWidgetData.storage = {
      ...finalWidgetData.storage,
      params: {
        base: ["USD", "EUR"],
        counter_currencies: ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD"],
        symbol: [
          "USDUSD",
          "USDEUR",
          "USDGBP",
          "USDJPY",
          "USDCHF",
          "USDCAD",
          "USDAUD",
          "USDNZD",
          "EURUSD",
          "EUREUR",
          "EURGBP",
          "EURJPY",
          "EURCHF",
          "EURCAD",
          "EURAUD",
          "EURNZD",
        ],
      },
    };
  }

  const result = finalWidgetData.external
    ? ExternalWidgetSchema.safeParse(finalWidgetData)
    : InternalWidgetSchema.safeParse(finalWidgetData);
  if (result.success) {
    if (import.meta.env.DEV) console.log("Widget is valid", result.data);
    // If the code reaches this point, the widget is valid
    const validatedWidget = result.data as WidgetT;
    if (widget?.isMinimized || widget?.originalH) {
      validatedWidget.isMinimized = widget.isMinimized;
      validatedWidget.originalH = widget.originalH;
    }
    return validatedWidget;
  }

  const errors = formatZodIssues(result.error?.issues, [], finalWidgetData);
  toast.error("Widget is invalid", {
    description: formatZodErrorMessage(errors.join("\n\n")),
  });
  throw new Error(result.error.message);
}

function determineTabsForWidget(equityTemplate, widgetKey) {
  const tabs = equityTemplate.tabs;
  const tabsWidgetBelongsTo = [];

  for (const tabId in tabs) {
    if (tabs[tabId].widgetKeys.includes(widgetKey)) {
      // Use tabId if you want to return the IDs, or tabs[tabId].name if you want to return the names.
      tabsWidgetBelongsTo.push(tabId);
    }
  }

  return tabsWidgetBelongsTo;
}

export const diffItemsWithRemote = (currentState: Items, remoteState: Items | null) => {
  if (!remoteState) return currentState;
  if (!currentState) throw new Error("Current state is empty");
  const diff = {};

  // Iterate over each item in the current state
  for (const [key, value] of Object.entries(currentState)) {
    // If the item doesn't exist in the remote state or is different, add it to the diff
    if (!(remoteState[key] && isEqual(value, remoteState[key]))) {
      diff[key] = value;
    }
  }

  // Iterate over each item in the remote state
  for (const key of Object.keys(remoteState)) {
    // If the item doesn't exist in the current state, mark it as "DELETE" in the diff
    if (!currentState[key]) {
      diff[key] = "DELETE";
    }
  }

  return diff;
};
