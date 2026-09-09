import isEqual from "lodash.isequal";
import {
  createContext,
  type ReactElement,
  type ReactNode,
  useContext,
  useMemo,
  useRef,
} from "react";
import { toast } from "sonner";
import { subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { shallow } from "zustand/shallow";
import { createWithEqualityFn, useStoreWithEqualityFn } from "zustand/traditional";
import type { ParamDef, WidgetColumnDefT, WidgetJsonT } from "~/components/types";
import { type DispatchAction, reducerAction } from "~/hooks/useStateReducer";
import {
  clearWidgetBuilderStorage,
  loadFormStateFromStorage,
  loadWidgetConfigFromStorage,
  saveFormStateToStorage,
  saveWidgetConfigToStorage,
} from "./persistence";
import type { FormState, WidgetConfiguration } from "./types";
import { analyzeDataForWidgetType, isTableWidgetType, testEndpoint } from "./utils";

const INITIAL_WIDGET_CONFIG: WidgetConfiguration = {
  name: "",
  description: "",
  endpoint: "",
  type: "table",
  category: "",
  subCategory: "",
  runButton: false,
  gridData: { w: 20, h: 9, minW: 10, minH: 5, maxW: 40, maxH: 100 },
  dataKey: "",
  wsEndpoint: "",
  wsRowIdColumn: "",
  params: [],
  enableCharts: false,
  showAll: false,
  chartViewEnabled: false,
  chartType: "column",
  columnsDefs: [],
  refetchInterval: 900000,
  dataUpdateDisplay: "",
  staleTime: 300000,
  source: [],
};

const INITIAL_FORM_STATE: FormState = {
  endpoint: "",
  authRequired: false,
  authHeaderKey: "",
  tokenBearer: "",
  isLoading: false,
  isDragging: false,
  previewData: null,
  error: null,
  lastTestedEndpoint: "",
  // UI state
  examplesOpen: false,
  isSaving: false,
  dataOrigin: "new_endpoint",
  selectedBackend: "",
  selectedWidget: "",
  activeConfigTab: "ui",
  jsonValue: "",
  jsonError: "",
  isUpdatingPreview: false,
  showClearConfirm: false,
  isGeneratingWithAI: false,
};

type KeyofWidgetConfig =
  | keyof WidgetConfiguration
  | `gridData.${keyof WidgetConfiguration["gridData"]}`;

interface WidgetConfigType {
  config: WidgetConfiguration;
  formState: FormState;
}
interface WidgetConfigState extends WidgetConfigType {
  getFormState: () => FormState;
  dispatchFormState: (action: DispatchAction<FormState>) => void;
  getPreviewWidget: () => WidgetJsonT;
  getWidgetConfig: () => WidgetConfiguration;
  setWidgetConfig: (config: WidgetConfiguration) => void;
  updateWidgetConfig: (config: Partial<WidgetConfiguration>) => void;
  changeAttribute: (field: KeyofWidgetConfig, value: any) => void;
  handleWidgetConfigChange: (field: KeyofWidgetConfig) => (value: any) => void;
  addParameter: () => void;
  removeParameter: (index: number) => void;
  updateParameter: (index: number, field: keyof ParamDef, value: any) => void;
  addColumnDef: () => void;
  getColumnDef: (index: number) => WidgetColumnDefT | undefined;
  removeColumnDef: (index: number) => void;
  updateColumnDef: (index: number, field: keyof WidgetColumnDefT, value: any) => void;
  toggleColumnVisibility: (index: number, hide: boolean) => void;
  showAllColumns: () => void;
  hideAllColumns: () => void;

  resetContext: () => void;
  handleInputChange: (
    field: keyof Pick<FormState, "endpoint" | "authHeaderKey" | "tokenBearer">,
  ) => (value: string) => void;
  handleCheckboxChange: (checked: boolean) => void;
  updateJsonFromConfig: () => void;
  updateConfigFromJson: (jsonString: string) => void;
  handleTestAndFetchData: (
    e: any,
    widgetType?: WidgetConfiguration["type"],
  ) => Promise<void>;
}

const createWidgetConfigStore = () => {
  const savedConfig = loadWidgetConfigFromStorage();
  const initialConfig = savedConfig
    ? { ...INITIAL_WIDGET_CONFIG, ...savedConfig }
    : INITIAL_WIDGET_CONFIG;

  const savedFormState = loadFormStateFromStorage();
  const initialFormState = savedFormState
    ? { ...INITIAL_FORM_STATE, ...savedFormState }
    : INITIAL_FORM_STATE;

  return createWithEqualityFn<WidgetConfigState>()(
    subscribeWithSelector((set, get) => ({
      config: initialConfig,
      formState: initialFormState,
      getFormState: () => get().formState,
      dispatchFormState: (action) => {
        set((state) => {
          const newState = reducerAction(state.formState, action);

          saveFormStateToStorage(newState);
          return { formState: newState };
        });
      },
      getWidgetConfig: () => get().config,
      setWidgetConfig: (config) => {
        set({ config });
        saveWidgetConfigToStorage(config);
      },
      handleWidgetConfigChange: (field) => (value) =>
        get().changeAttribute(field, value),
      updateWidgetConfig: (config) => {
        set((state) => {
          const newConfig = { ...state.config, ...config };
          saveWidgetConfigToStorage(newConfig);
          return { config: newConfig };
        });
      },
      changeAttribute: (field, value) => {
        set((state) => {
          const [gridField, subField] = field.split(".");
          const newConfig = { ...state.config };
          if (gridField === "gridData") {
            newConfig.gridData = {
              ...newConfig.gridData,
              [subField]: value ?? INITIAL_WIDGET_CONFIG.gridData?.[subField],
            };
          } else {
            newConfig[field] = value ?? INITIAL_WIDGET_CONFIG[field];
          }

          saveWidgetConfigToStorage(newConfig);
          return { config: newConfig };
        });
      },
      addParameter: () => {
        const newParam: ParamDef = {
          paramName: "",
          description: "",
          type: "text",
          value: "",
        };
        set((state) => {
          const newConfig = {
            ...state.config,
            params: [...state.config.params, newParam],
          };
          saveWidgetConfigToStorage(newConfig);
          return { config: newConfig };
        });
      },
      removeParameter: (index) => {
        set((state) => {
          const newConfig = {
            ...state.config,
            params: state.config.params.filter((_, i) => i !== index),
          };
          saveWidgetConfigToStorage(newConfig);
          return { config: newConfig };
        });
      },
      updateParameter: (index, field, value) => {
        set((state) => {
          const updatedParams = [...state.config.params];
          updatedParams[index] = {
            ...updatedParams[index],
            [field]: value,
          };
          const newConfig = {
            ...state.config,
            params: updatedParams,
          };
          saveWidgetConfigToStorage(newConfig);
          return { config: newConfig };
        });
      },
      getColumnDef: (index) => {
        const { columnsDefs } = get().config;
        return { ...columnsDefs[index] };
      },
      addColumnDef: () => {
        const newColumn: WidgetColumnDefT = {
          field: "",
          headerName: "",
          chartDataType: "category",
          cellDataType: "text",
          renderFn: [],
          width: 100,
          hide: false,
          pinned: undefined,
        };
        set((state) => {
          const newConfig = {
            ...state.config,
            columnsDefs: [...state.config.columnsDefs, newColumn],
          };
          saveWidgetConfigToStorage(newConfig);
          return { config: newConfig };
        });
      },
      removeColumnDef: (index) => {
        set((state) => {
          const newConfig = {
            ...state.config,
            columnsDefs: state.config.columnsDefs.filter((_, i) => i !== index),
          };
          saveWidgetConfigToStorage(newConfig);
          return { config: newConfig };
        });
      },
      updateColumnDef: (index, field, value) => {
        set((state) => {
          const updatedColumns = [...state.config.columnsDefs];
          updatedColumns[index] = {
            ...updatedColumns[index],
            [field]: value,
          };
          const newConfig = {
            ...state.config,
            columnsDefs: updatedColumns,
          };
          saveWidgetConfigToStorage(newConfig);
          return { config: newConfig };
        });
      },
      toggleColumnVisibility: (index, hide) => {
        set((state) => {
          const updatedColumns = [...state.config.columnsDefs];
          if (updatedColumns[index]) {
            updatedColumns[index].hide = hide;
          }
          const newConfig = {
            ...state.config,
            columnsDefs: updatedColumns,
          };
          saveWidgetConfigToStorage(newConfig);
          return { config: newConfig };
        });
      },
      showAllColumns: () => {
        set((state) => {
          const updatedColumns = state.config.columnsDefs.map((col) => ({
            ...col,
            hide: false,
          }));
          const newConfig = {
            ...state.config,
            columnsDefs: updatedColumns,
          };
          saveWidgetConfigToStorage(newConfig);
          return { config: newConfig };
        });
      },
      hideAllColumns: () => {
        set((state) => {
          const updatedColumns = state.config.columnsDefs.map((col) => ({
            ...col,
            hide: true,
          }));
          const newConfig = {
            ...state.config,
            columnsDefs: updatedColumns,
          };
          saveWidgetConfigToStorage(newConfig);
          return { config: newConfig };
        });
      },
      getPreviewWidget: () => {
        const { config: widgetConfig, formState } = get();
        const endpoint = formState.endpoint;

        const isTableWidget = isTableWidgetType(widgetConfig.type);

        const isLiveGrid = widgetConfig.type === "live_grid";
        return {
          widgetId: widgetConfig.widgetId || "preview_widget",
          name: widgetConfig.name || "Preview Widget",
          description: widgetConfig.description || "Preview widget description",
          endpoint: endpoint || "preview-endpoint",
          type: widgetConfig.type || "table",
          category: widgetConfig.category,
          subCategory: widgetConfig.subCategory,
          ...(widgetConfig.runButton && { runButton: widgetConfig.runButton }),
          gridData: widgetConfig.gridData,
          ...(widgetConfig.params?.length > 0 && {
            params: widgetConfig.params.map((param) => ({
              paramName: param.paramName,
              description: param.description,
              type: param.type,
              value: param.value,
              ...(param.label && { label: param.label }),
              ...(param.show !== undefined && { show: param.show }),
              ...(param.placeholder && { placeholder: param.placeholder }),
              ...(param.options && { options: param.options }),
              ...(param.multiSelect !== undefined && {
                multiSelect: param.multiSelect,
              }),
              ...(param.multiple !== undefined && { multiple: param.multiple }),
              ...((param as any).optionsEndpoint && {
                optionsEndpoint: (param as any).optionsEndpoint,
              }),
              ...(param.language && { language: param.language }),
            })),
          }),
          data: {
            ...(widgetConfig.dataKey && { dataKey: widgetConfig.dataKey }),
            ...(isLiveGrid &&
              widgetConfig.wsEndpoint && {
                wsEndpoint: widgetConfig.wsEndpoint,
              }),
            ...(isLiveGrid &&
              widgetConfig.wsRowIdColumn && {
                wsRowIdColumn: widgetConfig.wsRowIdColumn,
              }),
            ...(isTableWidget && {
              table: {
                enableCharts: widgetConfig.enableCharts,
                showAll: widgetConfig.showAll,
                ...(widgetConfig.chartViewEnabled && {
                  chartView: {
                    enabled: widgetConfig.chartViewEnabled,
                    chartType: widgetConfig.chartType,
                  },
                }),
                ...(widgetConfig.columnsDefs?.length > 0 && {
                  columnsDefs: widgetConfig.columnsDefs.map((column) => ({
                    field: column.field,
                    headerName: column.headerName,
                    chartDataType: column.chartDataType,
                    cellDataType: column.cellDataType,
                    formatterFn: column.formatterFn,
                    ...(column.renderFn?.length > 0 && {
                      renderFn: column.renderFn,
                    }),
                    ...(column.width && { width: column.width }),
                    ...(column.minWidth && { minWidth: column.minWidth }),
                    ...(column.maxWidth && { maxWidth: column.maxWidth }),
                    ...(column.hide && { hide: column.hide }),
                    ...(column.pinned && { pinned: column.pinned }),
                  })),
                }),
              },
            }),
          },
          refetchInterval: widgetConfig.refetchInterval,
          ...(widgetConfig.dataUpdateDisplay && {
            dataUpdateDisplay: widgetConfig.dataUpdateDisplay,
          }),
          staleTime: widgetConfig.staleTime,
          source: widgetConfig.source,
        } as WidgetJsonT;
      },
      resetContext: () => {
        clearWidgetBuilderStorage();
        set({
          config: INITIAL_WIDGET_CONFIG,
          formState: INITIAL_FORM_STATE,
        });
        toast.success("Widget builder cleared", {
          description: "All progress has been reset. You can start fresh now.",
        });
      },
      handleInputChange: (field) => (value) => {
        if (field === "endpoint") get().changeAttribute("type", "table");

        set((state) => ({
          formState: {
            ...state.formState,
            [field]: value,
            ...(field === "endpoint" && {
              previewData: null,
              error: null,
            }),
          },
        }));
      },
      handleCheckboxChange: (checked) => {
        set((state) => ({ formState: { ...state.formState, authRequired: checked } }));
      },
      updateJsonFromConfig: () => {
        const { getPreviewWidget, formState } = get();
        let jsonError = "";
        let jsonValue = formState.jsonValue;
        try {
          const { widgetId, ...previewWidgetForJson } = getPreviewWidget();
          jsonValue = JSON.stringify({ [widgetId]: previewWidgetForJson }, null, 2);
        } catch (error) {
          jsonError = "Failed to serialize configuration to JSON";
        }

        set((state) => ({ formState: { ...state.formState, jsonValue, jsonError } }));
      },
      updateConfigFromJson: (jsonString) => {
        try {
          const parsed = JSON.parse(jsonString);
          let widget: any;
          let widgetId: string | undefined;

          if (
            typeof parsed === "object" &&
            ("name" in parsed || "endpoint" in parsed || "type" in parsed)
          ) {
            widget = parsed;
          } else {
            widgetId = Object.keys(parsed)[0];
            widget = parsed[widgetId];
          }

          if (!widget || typeof widget !== "object") {
            throw new Error("Invalid widget JSON structure");
          }

          get().setWidgetConfig({
            widgetId: widgetId || widget.widgetId,
            name: widget.name || "",
            description: widget.description || "",
            endpoint: widget.endpoint || "",
            type: widget.type || "table",
            category: widget.category || "",
            subCategory: widget.subCategory || "",
            runButton: widget.runButton,
            gridData: {
              w: widget.gridData?.w || 20,
              h: widget.gridData?.h || 9,
              minW: widget.gridData?.minW || 10,
              minH: widget.gridData?.minH || 5,
              maxW: widget.gridData?.maxW || 40,
              maxH: widget.gridData?.maxH || 100,
            },
            dataKey: widget.data?.dataKey || "",
            wsEndpoint: widget.wsEndpoint || "",
            wsRowIdColumn: widget.data?.wsRowIdColumn || "",
            params: widget.params || [],
            enableCharts: widget.data?.table?.enableCharts,
            showAll: widget.data?.table?.showAll,
            chartViewEnabled: widget.data?.table?.chartView?.enabled,
            chartType: widget.data?.table?.chartView?.chartType,
            columnsDefs: widget.data?.table?.columnsDefs,
            refetchInterval: widget.refetchInterval,
            dataUpdateDisplay: widget.dataUpdateDisplay || "",
            staleTime: widget.staleTime || 300000,
            source: widget.source || [],
          });

          get().dispatchFormState({
            endpoint: (prev) => {
              if (prev !== widget.endpoint)
                get().handleTestAndFetchData(widget.endpoint);
              return widget.endpoint || prev;
            },
            jsonError: "",
          });
        } catch (error) {
          get().dispatchFormState({
            jsonError: error instanceof Error ? error.message : "Invalid JSON format",
          });
        }
      },
      handleTestAndFetchData: async (
        e: string,
        widgetType?: WidgetConfiguration["type"],
      ) => {
        const { config, formState: state } = get();

        const endpoint = typeof e === "string" ? e : state.endpoint;
        set((state) => ({
          formState: {
            ...state.formState,
            isLoading: true,
            error: null,
            previewData: null,
          },
        }));

        if (!endpoint.startsWith("http")) {
          return set((state) => ({
            formState: {
              ...state.formState,
              isLoading: false,
              error: "Invalid endpoint URL",
            },
          }));
        }
        const widgetParams = config.params ?? [];

        const paramDefs = widgetParams?.filter((p) => p.value);
        const dataKey = config.dataKey;
        try {
          const { data, headers, contentType } = await testEndpoint({
            endpoint,
            state,
            paramDefs,
            method: widgetType === "ssrm_advanced" ? "POST" : "GET",
            dataKey,
          });

          let previewData = data;

          const widgetVizType = analyzeDataForWidgetType(data, contentType);
          if (widgetVizType === "ssrm_advanced") {
            if (!paramDefs?.find((p) => p.paramName === "query")) {
              widgetParams.unshift({
                paramName: "query",
                value: "",
                type: "text",
                language: "sql",
                show: false,
              });
            }
            previewData = data?.rowData ?? previewData ?? [];
          }

          set((state) => ({
            config: {
              ...state.config,
              type: widgetVizType,
              endpoint,
              headers,
              ...(widgetParams && { params: widgetParams }),
            },
            formState: {
              ...state.formState,
              previewData,
              error: null,
              lastTestedEndpoint: endpoint,
            },
          }));
        } catch (error) {
          console.error("Error testing endpoint:", error);
          get().dispatchFormState({
            error:
              error instanceof Error
                ? error.message
                : "Failed to fetch data from endpoint",
          });
        } finally {
          get().dispatchFormState({ isLoading: false });
        }
      },
    })),
    shallow,
  );
};

export type WidgetConfigStore = ReturnType<typeof createWidgetConfigStore>;

const WidgetConfigContext = createContext<WidgetConfigStore | null>(null);

export function useWidgetConfigStore(): WidgetConfigStore {
  const store = useContext(WidgetConfigContext);

  if (!store) {
    throw new Error("useWidgetConfigStore must be used within a WidgetConfigProvider");
  }

  return store;
}

export function useWidgetConfigContext<T = WidgetConfigState>(
  selector: (store: WidgetConfigState) => T = (store) => store as unknown as T,
  equalityFn: (a: T, b: T) => boolean = (prev, next) => isEqual(prev, next),
) {
  const store = useContext(WidgetConfigContext);

  if (!store) {
    throw new Error(
      "useWidgetConfigContext must be used within a WidgetConfigProvider",
    );
  }

  return useStoreWithEqualityFn(store, useShallow(selector), equalityFn);
}

export function WidgetConfigProvider({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const storeRef = useRef<WidgetConfigStore>();
  if (!storeRef.current) {
    storeRef.current = createWidgetConfigStore();
  }

  const childrenMemo = useMemo(() => children, [children]);

  return (
    <WidgetConfigContext.Provider value={storeRef.current}>
      {childrenMemo}
    </WidgetConfigContext.Provider>
  );
}
