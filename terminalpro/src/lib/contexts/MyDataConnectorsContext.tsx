import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { createWidgetStudioWidget } from "~/components/AI/hooks/useGetAppWidgets";
import type {
  ItemType,
  POSSIBLE_SOURCES,
} from "~/components/DataConnectors/NewComponents/types";
import type { WidgetT } from "~/components/types";
import {
  type UserResourcePermissionsT,
  useUserResourcePermissions,
} from "~/hooks/useUserResourcePermissions";
import {
  type SingleWidget,
  type Source,
  type StoredFile,
  useShallowBackendConnectorStore,
  type WidgetMetadataItem,
} from "~/lib/state/backendConnector";
import type { Database, SnowflakeDatabase } from "~/lib/state/dataConnector";
import WIDGETS from "~/lib/widgets.json";
import type { WidgetType } from "~/utils/zodForms";
import { inSnowflakeNativeApp } from "../constants";
import { useAppStore } from "../state/app";
import { convertAdvancedBackend, generateRandomName, uuidv4 } from "../utils";

export const createDashboardWidget = (
  widget: any,
  widgetType: string,
): WidgetT | null => {
  switch (widgetType) {
    case "file":
      return {
        id: uuidv4(),
        endpoint: widget.url,
        type: "table" as const,
        external: true,
        category: widget.category ?? "Others",
        subCategory: widget.subCategory,
        widgetId: `file-${widget.id}` as const,
        dataKey: widget.dataKey,
        description: widget.description,
        name: widget.name,
        gridData: { w: 20, h: widget.extension === "pdf" ? 20 : 10 },
        data: {
          dataKey: widget.dataKey,
          table: { enableCharts: true },
        },
        source: widget.source,
        connectionType: "file" as const,
      };
    case "single":
      return {
        id: uuidv4(),
        name: widget.name,
        description: widget.description,
        category: widget.category ?? "Others",
        subCategory: widget.subCategory,
        endpoint: widget.endpoint,
        type: "table" as const,
        external: true,
        widgetId: widget.widgetId,
        dataKey: widget.dataKey,
        gridData: { w: 20, h: 7 },
        data: { table: { showAll: true, enableCharts: true } },
        source: widget.source,
        connectionType: "single" as const,
        endpointHeaders: widget.endpointHeaders,
      };
    case "rss":
      return {
        id: uuidv4(),
        widgetId: `rss_viewer-${widget.id}`,
        name: widget.name,
        description: widget.description,
        category: widget.category ?? "Others",
        subCategory: widget.subCategory,
        source: widget.source,
        type: "table" as const,
        external: true,
        storage: {
          feeds: widget.storage?.feeds,
        },
        data: {},
        connectionType: "widgetMetadata" as const,
      };
    case "website":
      return {
        id: uuidv4(),
        widgetId: `iframe-${widget.id}`,
        name: widget.name,
        description: widget.description,
        category: widget.category ?? "Others",
        subCategory: widget.subCategory,
        source: widget.source,
        external: true,
        storage: widget.storage,
        connectionType: "widgetMetadata" as const,
        type: "iframe",
        data: {},
      };
    case "youtube":
      return {
        id: uuidv4(),
        widgetId: `youtube-${widget.id}`,
        name: widget.name,
        description: widget.description,
        category: widget.category ?? "Others",
        subCategory: widget.subCategory,
        source: widget.source,
        external: true,
        storage: widget.storage,
        connectionType: "widgetMetadata" as const,
        type: "youtube",
        data: {},
      };
    case "note":
      return {
        id: uuidv4(),
        widgetId: `rich_note-${widget.id}`,
        name: widget.name,
        description: widget.description,
        category: widget.category ?? "Others",
        subCategory: widget.subCategory,
        external: true,
        source: widget.source,
        storage: widget.storage,
        connectionType: "widgetMetadata" as const,
        data: {},
        type: "note",
      };
    case "copilot_chart":
    case "copilot_table":
      return {
        id: uuidv4(),
        widgetId: `copilot_table-${widget.id}`,
        name: widget.name,
        description: widget.description,
        category: widget.category ?? "Others",
        subCategory: widget.subCategory,
        connectionType: "widgetMetadata" as const,
        source: widget.source,
        storage: widget.storage,
        data: { table: { enableCharts: true } },
        type: "table",
      };
    case "ag_chart":
    case "ag_chart_from_table":
      return {
        id: uuidv4(),
        widgetId: `${widgetType}-${widget.id}`,
        name: widget.name,
        description: widget.description,
        category: widget.category ?? "Others",
        subCategory: widget.subCategory,
        connectionType: "widgetMetadata" as const,
        source: widget.source,
        storage: widget.storage,
        data: {},
        type: "custom",
      };
    case "html":
      return {
        id: uuidv4(),
        widgetId: `html-${widget.id}`,
        name: widget.name,
        description: widget.description,
        category: widget.category ?? "Others",
        subCategory: widget.subCategory,
        connectionType: "widgetMetadata" as const,
        source: widget.source,
        storage: widget.storage,
        data: {},
        type: "html",
      };
    case "backend": {
      return {
        ...(widget as any),
        id: uuidv4(),
        external: true,
        sourceId: widget.backendId,
      };
    }
    case "widget_studio":
      return {
        ...widget,
        id: uuidv4(),
        widgetId: `widget_studio-${widget.id}`,
        category: widget.category ?? "Widget Studio",
        external: true,
        connectionType: "widgetMetadata" as const,
      };
    default:
      return null;
  }
};

export const findSelectedWidgets = (allElems: any[], selectedWidgets: Set<string>) => {
  const foundWidgets: any[] = [];

  allElems.forEach((elem) => {
    elem.items.forEach((item) => {
      if (elem.type === "backend" && item.widgets?.length === 0) {
        // means backend couldnt connect to see the widgets so we want to select only backend not the widgets inside
        foundWidgets.push({
          ...item,
          type: elem.type,
        });
      } else if ("widgets" in item && item.widgets) {
        item.widgets.forEach((widget: any) => {
          if (selectedWidgets.has(widget.selectionId)) {
            foundWidgets.push({
              ...widget,
              widgetType: elem.type,
              parentName: item.name,
            });
          }
        });
      } else if (selectedWidgets.has(item.selectionId)) {
        foundWidgets.push({
          ...item,
          widgetType: elem.type,
        });
      }
    });
  });

  return foundWidgets;
};

export const FILE_TYPES = {
  csv: ["csv"],
  json: ["json"],
  pdf: ["pdf"],
  excel: ["xlsx"],
  image: ["png", "jpg", "jpeg", "gif"],
  text: ["txt", "md", "docx", "html"],
};

export type SQLWidget = {
  id: number;
  name: string;
  description: string;
  widgets?: (Database & { widgetId: string })[];
};

export type SnowflakeWidget = {
  id: string;
  name: string;
  description: string;
  widgets?: (SnowflakeDatabase & { widgetId: string })[];
};

export type StoredFileWidget = {
  selectionId: string;
  id: string;
  name: string;
  description?: string;
  widgets?: (StoredFile & { widgetId: string })[];
};

export type ElementType<T extends POSSIBLE_SOURCES = POSSIBLE_SOURCES> = {
  type: T;
  items: ItemType<T>[];
  hideWhenEmpty?: boolean;
};

type SelectedWidgetsContextType = {
  selectedWidgets: Set<string>;
  toggleWidget: (id: string) => void;
  toggleGroup: (ids: string[]) => void;
  toggleAll: (ids: string[]) => void;
  isSelected: (id: string) => boolean;
  isGroupSelected: (ids: string[]) => "indeterminate" | boolean;
  allElems: ElementType[];
  handleAddToDashboard: (dashboards: string[] | "new", id?: string) => void;
  isLoading: boolean;
};

function formatType(type: string): string {
  if (type === "image") {
    return "Image";
  }
  return type.toUpperCase();
}

const formattedFileTypes = Object.keys(FILE_TYPES).map((key) => formatType(key));

export function isFileRoot(type: string) {
  return formattedFileTypes.includes(type);
}

function formatFile(files: StoredFile[]): StoredFileWidget[] {
  const results: StoredFileWidget[] = [];
  for (const key in FILE_TYPES) {
    const filtered: StoredFile[] = files.filter((file) =>
      FILE_TYPES[key].includes(file.extension),
    );
    const widgets = filtered.map((item) => ({
      ...item,
      widgetId: item.id ?? item.uuid,
      selectionId: `file,${key},${item.id ?? item.uuid}`,
    }));
    const fileType = key === "excel" ? "EXCEL (XLSX)" : formatType(key);
    const description = `${fileType} file uploads.`;
    if (filtered.length > 0) {
      results.push({
        id: key,
        name: `${formatType(key)}`,
        description,
        widgets,
        selectionId: `file,${key}`,
      });
    }
  }
  return results;
}

function formatBackendWidgets(source: Source): WidgetType[] {
  if (source.id === "root") {
    return Object.values(WIDGETS) as unknown as WidgetType[];
  }

  return convertAdvancedBackend(source).map((widget) => {
    return {
      ...widget,
      backendId: source.id,
      selectionId: `backend,${source.id},${widget.widgetId}`,
    };
  }) as unknown as WidgetType[];
}

const MyDataConnectorsContext = createContext<SelectedWidgetsContextType | null>(null);

export function createAllElements<T extends boolean = false>(params: {
  storedFiles: StoredFile[];
  apiSources: Source[];
  singleWidgets?: SingleWidget[];
  widgetMetadata?: WidgetMetadataItem[];
  rolePermissionsData?: UserResourcePermissionsT<T>;
  withOthers?: boolean;
}): ElementType[] {
  const notInSnowflake = !inSnowflakeNativeApp;

  const {
    storedFiles,
    singleWidgets,
    apiSources,
    widgetMetadata,
    rolePermissionsData,
    withOthers = true,
  } = params;

  const fileIds = storedFiles?.reduce(
    (acc, file) => {
      acc[file.uuid] = true;
      return acc;
    },
    {} as Record<string, boolean>,
  );

  const ownedBackends = apiSources.filter((item) => item.status === "success");

  const ownedBackendIds = ownedBackends.reduce(
    (acc, backend) => {
      acc[backend.uuid] = true;
      return acc;
    },
    {} as Record<string, boolean>,
  );

  const sharedFileIds = rolePermissionsData?.files?.reduce(
    (acc, file) => {
      acc[file.uuid] = true;
      return acc;
    },
    {} as Record<string, boolean>,
  );

  const sharedBackendIds = rolePermissionsData?.backends?.reduce(
    (acc, backend) => {
      acc[backend.uuid] = true;
      return acc;
    },
    {} as Record<string, boolean>,
  );

  const sharedBackends = (rolePermissionsData?.backends ?? [])
    .filter((item) => !ownedBackendIds?.[item.uuid] && item.status === "success")
    .map((item) => ({
      ...item,
      isSharedSource: true,
      widgets: Object.values(item.widgets ?? {}).map((widget) => ({
        ...widget,
        backendId: item.id,
        selectionId: `backend,${item.id},${widget.widgetId}`,
        isSharedWidget: true,
        shared: true,
      })),
      selectionId: `backend,${item.uuid}`,
      shared: true,
    }));

  return [
    {
      type: "backend",
      items: [
        ...apiSources
          .filter((item) => item.status === "success")
          .map((item) => ({
            ...item,
            widgets: formatBackendWidgets(item),
            selectionId: `backend,${item.uuid ?? item.id}`,
            shared: sharedBackendIds?.[item.uuid] ?? false,
          })),
        ...sharedBackends,
      ],
    },
    notInSnowflake && {
      type: "file",
      items: formatFile([
        ...(storedFiles?.map((file) => ({
          ...(file as unknown as StoredFile),
          shared: sharedFileIds?.[file.uuid] ?? false,
        })) ?? []),
        ...(rolePermissionsData?.files
          ?.filter((file) => !fileIds?.[file.uuid])
          ?.map((file) => ({
            ...(file as unknown as StoredFile),
            isSharedWidget: true,
            shared: true,
          })) ?? []),
      ]),
    },
    {
      type: "others",
      items: withOthers
        ? [
            notInSnowflake && {
              type: "single",
              name: "API Endpoints",
              widgets: singleWidgets?.map((item) => ({
                ...item,
                selectionId: `single,${item.uuid ?? item.id ?? item.widgetId}`,
              })),
            },
            notInSnowflake && {
              type: "rss",
              name: "RSS Feeds",
              widgets: widgetMetadata
                ?.filter((item) => item.widgetType === "rss_viewer")
                ?.map((item) => ({
                  ...item,
                  id: item.widgetId,
                  selectionId: `rss,${item.widgetId}`,
                })),
            },
            notInSnowflake && {
              type: "website",
              name: "Iframes",
              widgets: widgetMetadata
                ?.filter((item) => item.widgetType === "iframe")
                ?.map((item) => ({
                  ...item,
                  id: item.widgetId,
                  selectionId: `website,${item.widgetId}`,
                })),
            },
            notInSnowflake && {
              type: "youtube",
              name: "YouTube",
              widgets: widgetMetadata
                ?.filter((item) => item.widgetType === "youtube")
                ?.map((item) => ({
                  ...item,
                  id: item.widgetId,
                  selectionId: `youtube,${item.widgetId}`,
                })),
            },
            {
              type: "note",
              name: "Notes",
              widgets: widgetMetadata
                ?.filter((item) => item.widgetType === "rich_note")
                ?.map((item) => ({
                  ...item,
                  id: item.widgetId,
                  selectionId: `note,${item.widgetId}`,
                })),
              hideWhenEmpty: true,
            },
          ].filter(Boolean)
        : [],
    },
    {
      type: "user_widgets",
      items: [
        {
          type: "ag_charts",
          name: "Charts",
          widgets: widgetMetadata
            ?.filter(
              (item) =>
                item.widgetType === "ag_chart_from_table" ||
                item.widgetType === "ag_chart",
            )
            ?.map((item) => ({
              ...item,
              id: item.widgetId,
              selectionId: `${item.widgetType},${item.widgetId}`,
            })),
          hideWhenEmpty: true,
        },
      ],
    },
    {
      type: "ai_artifacts",
      items: [
        {
          type: "copilot_table",
          name: "Tables",
          widgets: widgetMetadata
            ?.filter(
              (item) =>
                item.widgetType === "copilot_table" &&
                item.storage?.chartView?.enabled !== true,
            )
            ?.map((item) => ({
              ...item,
              id: item.widgetId,
              selectionId: `copilot_table,${item.widgetId}`,
            })),
          hideWhenEmpty: true,
        },
        {
          type: "copilot_chart",
          name: "Charts",
          widgets: widgetMetadata
            ?.filter(
              (item) =>
                item.widgetType === "copilot_table" &&
                item.storage?.chartView?.enabled === true,
            )
            ?.map((item) => ({
              ...item,
              id: item.widgetId,
              selectionId: `copilot_table,${item.widgetId}`,
            })),
          hideWhenEmpty: true,
        },
        {
          type: "html",
          name: "HTML",
          widgets: widgetMetadata
            ?.filter((item) => item.widgetType === "html")
            ?.map((item) => ({
              ...item,
              id: item.widgetId,
              selectionId: `html,${item.widgetId}`,
            })),
          hideWhenEmpty: true,
        },
      ],
    },
    {
      type: "widget_studio",
      items:
        widgetMetadata
          ?.filter((item) => item.widgetType === "widget_studio")
          ?.map((item) => ({
            ...createWidgetStudioWidget(item),
            id: item.widgetId,
            selectionId: `widget_studio,${item.widgetId}`,
          })) ?? [],
    },
  ].filter(Boolean) as ElementType[];
}

export function getTypeToUse(type: string, selectionId: string, parentType?: string) {
  const splitType = ["others", "ai_artifacts", "user_widgets"].some((t) => type === t);

  return splitType ? selectionId.split(",")[0] : (parentType ?? type);
}

export function MyDataConnectorsProvider({ children }: { children: ReactNode }) {
  const {
    data: rolePermissionsData,
    isLoading: isLoadingPermissions,
    error,
  } = useUserResourcePermissions();

  const { storedFiles, singleWidgets, apiSources, widgetMetadata, isLoadingBackends } =
    useShallowBackendConnectorStore((s) => ({
      storedFiles: s.storedFiles,
      singleWidgets: s.singleWidgets,
      apiSources: s.apiSources,
      widgetMetadata: s.widgetMetadata,
      isLoadingBackends: s.isLoadingBackends,
    }));
  const isLoading = isLoadingPermissions || isLoadingBackends;
  const [selectedWidgets, setSelectedWidgets] = useState<Set<string>>(new Set());

  const navigate = useNavigate();

  const allElems = useMemo(
    () =>
      createAllElements({
        storedFiles,
        singleWidgets,
        apiSources,
        widgetMetadata,
        rolePermissionsData,
      }),
    [storedFiles, singleWidgets, apiSources, widgetMetadata, rolePermissionsData],
  );

  const handleAddToDashboard = useCallback(
    (dashboards: string[] | "new", individualWidgetId?: string) => {
      const foundWidgets = findSelectedWidgets(
        allElems,
        individualWidgetId ? new Set([individualWidgetId]) : selectedWidgets,
      );
      const isNewDashboard = dashboards === "new";

      const dashboardWidgets = [] as WidgetT[];

      for (const widget of foundWidgets) {
        if (!widget?.widgetType) continue;
        // we need to do something like this because Category of these widgets are now "Others"
        const typeToUse = getTypeToUse(widget.widgetType, widget.selectionId);

        const dashboardWidget = createDashboardWidget(widget, typeToUse);
        if (dashboardWidget) {
          dashboardWidgets.push(dashboardWidget);
        }
      }

      let dashId = "";

      if (isNewDashboard) {
        const newDashboardId = uuidv4();
        dashId = newDashboardId;
        useAppStore.getState().addTab({
          index: newDashboardId,
          data: {
            name: generateRandomName(),
            type: "custom",
            widgets: dashboardWidgets,
          },
        });
      } else {
        dashId = dashboards[0];
        useAppStore.getState().addWidgetsToTabs(dashboards, dashboardWidgets);
      }

      if (dashboardWidgets.length === 0) {
        toast.error("No widgets found", {
          description: "No valid widgets found to add to the dashboard",
        });
        return;
      }

      toast.success(`Added ${dashboardWidgets.length} widgets to selected dashboards`, {
        description: "Navigate to the dashboard to view the widgets",
        action: {
          label: "See Dashboard",
          onClick: () => navigate(`/app/${dashId}`),
        },
      });
    },
    [allElems, selectedWidgets, navigate],
  );

  const toggleWidget = useCallback((id: string) => {
    setSelectedWidgets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleGroup = useCallback((ids: string[]) => {
    setSelectedWidgets((prev) => {
      const allSelected = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      for (const id of ids) {
        if (allSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      return next;
    });
  }, []);

  const toggleAll = (ids: string[]) => {
    setSelectedWidgets((prev) => {
      const allSelected = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      for (const id of ids) {
        if (allSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      return next;
    });
  };

  const isSelected = useCallback(
    (id: string) => selectedWidgets.has(id),
    [selectedWidgets],
  );

  const isGroupSelected = useCallback(
    (ids: string[]) => {
      const selectedCount = ids.filter((id) => selectedWidgets.has(id)).length;
      if (selectedCount === 0) return false;
      if (selectedCount === ids.length) return true;
      return "indeterminate";
    },
    [selectedWidgets],
  );

  return (
    <MyDataConnectorsContext.Provider
      value={{
        selectedWidgets,
        toggleWidget,
        toggleGroup,
        toggleAll,
        isSelected,
        isGroupSelected,
        allElems,
        handleAddToDashboard,
        isLoading,
      }}
    >
      {children}
    </MyDataConnectorsContext.Provider>
  );
}

export const useMyDataConnectors = () => {
  const context = useContext(MyDataConnectorsContext);
  if (!context) {
    throw new Error("useMyDataConnectors must be used within MyDataConnectorsProvider");
  }
  return context;
};
