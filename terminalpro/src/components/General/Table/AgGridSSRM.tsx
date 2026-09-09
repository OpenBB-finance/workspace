import type {
  ColDef,
  GridOptions,
  IServerSideDatasource,
  IServerSideGetRowsParams,
  IServerSideGetRowsRequest,
  PaginationChangedEvent,
  RowGroupOpenedEvent,
} from "ag-grid-enterprise";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import DraggableCard from "~/components/DraggableCard";
import { useWidgetContext } from "~/components/Widget.context";
import { useCallbackRef } from "~/hooks/useRefHooks";
import { type QueryOptions, type TResponseCb, useJsonData } from "~/lib/api";
import {
  useShallowBackendConnectorStore,
  type WidgetMetadataItem,
} from "~/lib/state/backendConnector";
import { useShallowCopilotDataStore } from "~/lib/state/copilotData";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn, dispatchUpdateWidget, isSSRMType } from "~/lib/utils";
import { handleWidgetMetadata } from "~/utils/dataConnectorsHelpers";
import { TOTAL_CELL_LIMIT } from "./AgGrid";
import { getColumnDefs, getContextMenuItems, onPivotModeChanged } from "./AgGridUtils";
import { ChartViewButton, ChartViewElement } from "./Chart/AgChartView";
import useChartOptions, {
  useChartToolPanelAction,
} from "./Chart/hooks/useChartOptions";
import {
  AgGridProvider,
  ensureAgGrid,
  useAgExportFuncs,
  useAgGridContext,
  useColumnVisibility,
  useQuickActionsSettings,
} from "./hooks";
import type { AgGridEvents } from "./hooks/types";
import { getSelectedRangeData } from "./hooks/useCreateChart";
import { useSizeColumns } from "./hooks/useUpdateColumnState";
import { useIsFirstRender } from "./hooks/utils";
import { useWidgetParamsPositions } from "./NavBar/QueryParams";
import { FormulasToolDef } from "./SubMenus/FormulasToolPanel";
import TableSettings from "./SubMenus/TableSettings";
import {
  getNewQuery,
  getQueryState,
  getSSRRows,
  getTableData,
  type QueryState,
  type SSRMRunCompleteDetail,
  type SSRResponse,
} from "./utils";

export type AgSSRState = {
  rowData: any[];
  columnDefs: ColDef[];
  decimalDigitsSettings: number;
};
const paginationPageSizeSelector = [500, 1000, 5000];

export function AgGridSSRTable() {
  const widget = useWidgetContext()?.widget;
  const chartView = widget.storage?.chartView?.enabled;

  const decimalDigits = useShallowThemeStore((s) => s.decimalDigits);

  const decimalDigitsToUse = widget?.storage?.decimalDigits ?? decimalDigits;
  const [decimalDigitsSettings, setDecimalDigitsSettings] =
    useState(decimalDigitsToUse);

  const ssrmGridOptions = useSSRMGridOptions();

  const exportFns = useAgExportFuncs();
  const quickActions = useQuickActionsSettings();
  const ChartToolPanelActions = useChartToolPanelAction();

  const extraSettings = useMemo(() => {
    return [quickActions, ...(chartView ? ChartToolPanelActions : [])];
  }, [chartView, quickActions, ChartToolPanelActions]);

  const { renderRow0Params, renderBelowNavbarRows } = useWidgetParamsPositions();
  const handleSave = useColumnVisibility(decimalDigitsSettings);

  return (
    <DraggableCard
      aiEnabled={true}
      aiData={true}
      loading={ssrmGridOptions.isLoading}
      error={ssrmGridOptions.error}
      showActionsSettings={true}
      onSaveSettings={handleSave}
      settingsModalChildren={
        <TableSettings
          decimalDigitsSettings={decimalDigitsSettings}
          setDecimalDigitsSettings={setDecimalDigitsSettings}
        />
      }
      elementRightNextToTitle={renderRow0Params}
      elementBelowNavbar={renderBelowNavbarRows}
      exportFns={exportFns}
      extraNavbarElements={<ChartViewButton />}
      extraSettings={extraSettings}
    >
      {chartView && <ChartViewElement />}
      <div
        className={cn("flex grow h-full", {
          "h-[calc(100%-6px)] min-h-[100px]": !chartView,
          "h-0 w-0 max-h-0": chartView,
        })}
      >
        <AgGridSSRTableProvider ssrmGridOptions={ssrmGridOptions} />
      </div>
    </DraggableCard>
  );
}

function getGridOptions(
  isPivotMode: boolean,
  openedToolPanel?: string,
): GridOptions<any> {
  return {
    ...SSRGridOptions,
    sideBar: {
      toolPanels: isPivotMode ? ToolPanels : [...ToolPanels, FormulasToolDef],
      defaultToolPanel: openedToolPanel,
    },
  };
}

export const AgGridSSRTableProvider = memo(
  (props: { ssrmGridOptions: AgGridSSRGridOptionsReturn }) => {
    const { Datasource, tableData, onRowGroupOpened } = props.ssrmGridOptions;

    const { widget, updateWidget } = useWidgetContext();

    const contextMenuItems = useCallback(
      (params) =>
        getContextMenuItems(params, { enableChart: true, widgetId: widget?.id }),
      [],
    );

    const agChartViewProps = useChartOptions();

    const onPaginationChanged = useCallback((event: PaginationChangedEvent) => {
      const pageSize = event.api?.paginationGetPageSize();
      if (pageSize) {
        event.api?.setGridOption("cacheBlockSize", pageSize);
      }
    }, []);

    const gridOptions = useMemo(
      () =>
        getGridOptions(widget?.storage?.isPivotMode, widget?.storage?.openedToolPanel),
      [widget?.storage?.isPivotMode, widget?.storage?.openedToolPanel],
    );

    const sizeColumns = useSizeColumns();

    const onEventProps = useMemo(() => {
      return {
        onColumnRowGroupChanged: sizeColumns,
        onColumnValueChanged: sizeColumns,
        onColumnPivotChanged: sizeColumns,
        onColumnPivotModeChanged: (event: AgGridEvents) =>
          onPivotModeChanged(event, updateWidget),
      } as Partial<GridOptions<any>>;
    }, [sizeColumns, updateWidget]);

    return (
      <AgGridProvider
        rowData={tableData.rowData}
        columnDefs={tableData.columnDefs}
        gridOptions={gridOptions}
        rowGroupPanelShow="onlyWhenGrouping"
        getContextMenuItems={contextMenuItems}
        groupDisplayType="multipleColumns"
        paginationPageSizeSelector={paginationPageSizeSelector}
        paginationPageSize={widget?.storage?.paginationPageSize ?? 500}
        rowModelType="serverSide"
        cacheBlockSize={widget?.storage?.paginationPageSize ?? 500}
        maxBlocksInCache={10}
        serverSideDatasource={Datasource}
        onRowGroupOpened={onRowGroupOpened}
        onPaginationChanged={onPaginationChanged}
        {...onEventProps}
        {...agChartViewProps}
      />
    );
  },
);

const OPTIONS = {
  enabled: true,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  staleTime: Number.POSITIVE_INFINITY,
  refetchInterval: undefined,
  retry: 0,
};

type ColumnData = { rowData: Record<string, any>[]; columnDefs: ColDef[] };

export interface SSRMGridConfig {
  suppressDefaultErrorToast?: boolean;
  onError?: (errorMessage: string) => void;
  onRunComplete?: (detail: SSRMRunCompleteDetail) => void;
}

export function useSSRMGridOptions(queryValue?: string, config?: SSRMGridConfig) {
  const { widget, isPreview, getWidget } = useWidgetContext();
  const {
    params: storedParams,
    ssmRequest,
    ssrmDisabled,
    isPivotMode,
    paginationPageSize = 500,
    sqlParamDefs,
  } = useWidgetContext()?.widget?.storage || {};

  const gridRef = useAgGridContext()?.gridRef;
  const isFirstRequestRef = useRef(true);
  const isFirstRender = useIsFirstRender();
  const currentSSMRequestRef = useRef<IServerSideGetRowsRequest | null>(null);
  const refreshQueryRef = useRef(widget?.refreshQuery);
  const addData = useAddCopilotWidgetData();
  const beginWidgetCopilotExecution = useShallowCopilotDataStore(
    (state) => state.beginWidgetCopilotExecution,
  );

  const { params, sqlQuery, sqlParams } = useMemo(() => {
    const output = { params: storedParams, sqlQuery: queryValue, sqlParams: "" };
    if (widget.type === "ssrm_table") return output;

    const { query, ...rest } = { ...(storedParams || {}) };

    const sqlParams = {} as Record<string, any>;

    for (const param of sqlParamDefs || []) {
      let value = storedParams?.[param.paramName];
      if (value === undefined || value === null) value = param.value;
      if (Array.isArray(value)) value = value.sort();

      sqlParams[param.paramName] = value;
      delete rest[param.paramName];
    }
    const sqlQuery = getNewQuery(queryValue, sqlParams);

    const params = Object.keys(rest).length === 0 ? null : rest;
    return { params, sqlQuery, sqlParams: JSON.stringify(sqlParams, null, 0) };
  }, [storedParams, sqlParamDefs, queryValue]);

  const currentSqlQueryRef = useRef({ queryValue, sqlParams });

  const [queryState, setQueryState] = useState<QueryState>(() =>
    getQueryState(params, ssmRequest, sqlQuery, ssrmDisabled),
  );

  const queryOptions = useMemo(() => {
    const widget = getWidget();
    return {
      url: widget?.endpoint?.url,
      endpointHeaders: {
        "Content-Type": "application/json",
        ...(widget?.endpoint?.headers ?? {}),
      },
      method: "POST",
    } as QueryOptions;
  }, [getWidget]);

  const responseCb = useCallback<TResponseCb<Record<string, any>[]>>(
    async (resp, resolve) => {
      const data: SSRResponse = await resp.json();
      if (!data?.rowData) {
        resolve(null);
        return;
      }
      const rowData = getTableData(data.rowData, widget);
      resolve(rowData);
    },
    [widget?.data?.table?.columnsDefs, widget?.data?.dataKey],
  );

  const {
    data: rowData,
    isLoading,
    dataUpdatedAt,
    error,
    refetch,
  } = useJsonData<Record<string, any>[]>(
    {
      ...queryOptions,
      ...queryState,
      body: { startRow: 0, endRow: 500, ...(sqlQuery ? { query: sqlQuery } : {}) },
      responseCb,
    },
    { ...OPTIONS, enabled: !ssrmDisabled && queryState?.body?.query === sqlQuery },
  );

  const { data: initResponse, isLoading: initIsLoading } = useJsonData<SSRResponse>(
    { ...queryOptions, ...queryState },
    {
      ...OPTIONS,
      enabled: !queryState.body?.disableCache && queryState?.body?.query === sqlQuery,
    },
  );

  const loading = isLoading || initIsLoading;

  const tableData = useMemo(() => {
    if (!rowData) return { rowData: null, columnDefs: null } as ColumnData;
    const columnDefs = getColumnDefs(rowData, widget);
    return { rowData, columnDefs };
  }, [rowData, widget?.data?.table?.columnsDefs, widget?.data?.dataKey]);

  useEffect(() => {
    if (isFirstRender || !sqlQuery) return;
    addData({ request: ssmRequest } as IServerSideGetRowsParams);
    if (refreshQueryRef.current !== widget?.refreshQuery) {
      refreshQueryRef.current = widget?.refreshQuery;
      return;
    }
    const prev = { ...currentSqlQueryRef.current };
    const current = { queryValue, sqlParams };
    currentSqlQueryRef.current = { queryValue, sqlParams };

    if (
      prev.queryValue === current.queryValue &&
      prev.sqlParams !== current.sqlParams
    ) {
      isFirstRequestRef.current = true;
      return;
    }
    const newSsmRequest = { startRow: 0, endRow: paginationPageSize };
    setQueryState(getQueryState(params, newSsmRequest, sqlQuery, isPivotMode));
  }, [sqlQuery, refreshQueryRef]);

  useEffect(() => {
    if (loading || isFirstRender || !(ssmRequest || sqlQuery)) return;

    setQueryState(getQueryState(params, ssmRequest, sqlQuery, isPivotMode));
    queueMicrotask(() => {
      if (ensureAgGrid(gridRef.current)) {
        gridRef.current?.api?.refreshServerSide({ purge: true });
      }
    });
  }, [gridRef, widget?.refreshQuery, sqlParams]);

  useEffect(() => {
    if (isFirstRequestRef.current) return;

    if (!initResponse?.rowData) isFirstRequestRef.current = true;
  }, [initResponse?.rowData, gridRef, isFirstRequestRef]);

  useEffect(() => {
    if (isFirstRequestRef.current) {
      addData({ request: ssmRequest } as IServerSideGetRowsParams, {
        captureExecutedParams: false,
      });
    }

    if (ensureAgGrid(gridRef.current)) {
      gridRef.current?.api?.refreshServerSide({ purge: true });
    }
    if (isPreview) refetch();
  }, [params, gridRef, isPreview ? widget?.data?.table?.columnsDefs : null]);

  const getRows = useCallback(
    async (rowParams: IServerSideGetRowsParams) => {
      const widget = getWidget();
      beginWidgetCopilotExecution(widget.id, { ...(widget.storage?.params || {}) });
      let response: SSRResponse | null = null;

      const isRootLevel = rowParams?.parentNode?.level === -1;
      const isInitialPageRequest =
        isRootLevel && (rowParams.request.startRow ?? 0) === 0;
      const notifyRunComplete = (detail: SSRMRunCompleteDetail) => {
        if (isInitialPageRequest) config?.onRunComplete?.(detail);
      };

      if (isFirstRequestRef.current && initResponse?.rowData && isRootLevel) {
        response = initResponse;
      } else {
        const state = getQueryState(params, rowParams.request, sqlQuery);
        response = await getSSRRows(widget.endpoint, state.params, state.body);

        if (isRootLevel) {
          dispatchUpdateWidget(widget.id, (prev) => ({
            ...prev,
            storage: { ...prev.storage, ssmRequest: state.body },
          }));
        }
      }

      if (rowParams?.api?.isDestroyed()) return;

      if (response?.error) {
        config?.onError?.(response.error);
        if (!config?.suppressDefaultErrorToast) {
          toast.error("Error fetching data", { description: response.error });
        }
        currentSSMRequestRef.current = rowParams.request;
        isFirstRequestRef.current = false;
        notifyRunComplete({
          requestSucceeded: false,
          hasData: false,
          rowCount: 0,
        });
        rowParams.fail();
        return;
      }

      if (!response?.rowData) {
        notifyRunComplete({
          requestSucceeded: false,
          hasData: false,
          rowCount: 0,
        });
        return rowParams.fail();
      }

      currentSSMRequestRef.current = rowParams.request;

      queueMicrotask(() =>
        setTimeout(() =>
          addData(rowParams, {
            captureExecutedParams: true,
          }),
        ),
      );

      isFirstRequestRef.current = false;
      notifyRunComplete({
        requestSucceeded: true,
        hasData: response.rowData.length > 0,
        rowCount: response.rowData.length,
        rowData: response.rowData,
      });
      return rowParams.success(response);
    },
    [
      getWidget,
      addData,
      initResponse,
      params,
      isFirstRequestRef,
      currentSSMRequestRef,
      sqlQuery,
      beginWidgetCopilotExecution,
      config,
    ],
  );

  const getRowsRef = useRef(getRows);
  useEffect(() => {
    getRowsRef.current = getRows;
  }, [getRows]);

  const Datasource = useMemo((): IServerSideDatasource => {
    return {
      getRows: async (params: IServerSideGetRowsParams) => {
        getRowsRef.current(params);
      },
    };
  }, [getRowsRef]);

  const onRowGroupOpened = useCallback(
    (event: RowGroupOpenedEvent) => {
      const params = { api: event.api, request: currentSSMRequestRef.current };
      addData(params as IServerSideGetRowsParams, { captureExecutedParams: false });
    },
    [addData, currentSSMRequestRef],
  );

  return useMemo(
    () => ({
      Datasource,
      isLoading: loading,
      error,
      tableData,
      dataUpdatedAt,
      onRowGroupOpened,
    }),
    [Datasource, dataUpdatedAt, loading, error, tableData, onRowGroupOpened],
  );
}

export type AgGridSSRGridOptionsReturn = ReturnType<typeof useSSRMGridOptions>;

export type WidgetDataState = {
  aiData: any[];
  ssmRequest: IServerSideGetRowsRequest | null;
};

type CopilotSnapshotOptions = {
  captureExecutedParams?: boolean;
};

function useAddCopilotWidgetData() {
  const { widget, widgetFromJSON } = useWidgetContext();
  const language = useMemo(
    () =>
      isSSRMType(widget.type) &&
      widget.params?.find((p) => p.paramName === "query")?.language,
    [widget.params],
  );

  const backendSchemas = useShallowBackendConnectorStore(
    (state) =>
      isSSRMType(widget.type) && state.getApiSourceById(widget.sourceId || "")?.schemas,
  );

  const sqlSchemas = useMemo(() => {
    const schemaName = widget.schemaName;
    if (language !== "sql" || !backendSchemas) {
      return { schema: undefined, allSchemas: undefined };
    }

    if (schemaName === "ALL_DATABASES_ALL_SCHEMAS_ALL_TABLES") {
      return { schema: undefined, allSchemas: backendSchemas };
    }

    return { schema: backendSchemas[schemaName], allSchemas: undefined };
  }, [language, widget.schemaName, backendSchemas]);

  const widgetInfo = useMemo(() => {
    const widgetdata = handleWidgetMetadata<WidgetMetadataItem>(widget);
    const { widgetConfig, ...widgetMetadata } = widgetdata || {};

    const name = widget?.name || widgetFromJSON?.name;
    const description = widget?.description || widgetFromJSON?.description;
    const source = widgetFromJSON?.source || widget?.source;
    return {
      name,
      description,
      source: Array.isArray(source) ? source[0] : source || "",
      metadata: {
        ...(widgetMetadata || {}),
        ...(widget?.metadata || {}),
        ...{ params: widget?.storage?.params || {} },
        ...(sqlSchemas.schema ? { schema: sqlSchemas.schema } : {}),
      },
    };
  }, [
    widget?.name,
    widget?.description,
    widget?.widgetId,
    widget?.storage?.params,
    widget?.metadata,
    widgetFromJSON,
    sqlSchemas,
  ]);

  const addDataOnDashboardWidget = useShallowCopilotDataStore(
    (state) => state?.addDataOnDashboardWidget,
  );

  const addWidgetFullData = useCallbackRef(
    (
      data: any[],
      request: IServerSideGetRowsRequest,
      options: CopilotSnapshotOptions = {},
    ) => {
      const columnCount = Object.keys(data?.[0] || {}).length;
      if (columnCount * data?.length > TOTAL_CELL_LIMIT) return;

      const { name, description, source, metadata } = widgetInfo;

      const { groupKeys, ...ssmRequest } = request || {};
      queueMicrotask(() => {
        setTimeout(() => {
          addDataOnDashboardWidget(widget.id, {
            data,
            captureExecutedParams: options.captureExecutedParams === true,
            innerTab: widget.innerTab,
            title: name,
            description,
            endpointUrl: widget.endpoint?.url || "",
            metadata: {
              ...(metadata || {}),
              ...(source ? { source } : {}),
              lastUpdated: Date.now(),
              ssmRequest: {
                ...ssmRequest,
                groupKeys: [],
              },
            },
          });
        });
      });
    },
  );

  const addWidgetData = useCallbackRef(
    (params: IServerSideGetRowsParams, options: CopilotSnapshotOptions = {}) => {
      const ssmRequest = params.request;
      if (!ensureAgGrid(params)) return addWidgetFullData([], ssmRequest, options);
      const hiddenColIds = params.api.getState()?.columnVisibility?.hiddenColIds || [];

      const selectedRowNodes = [] as Record<string, any>[];

      params.api.forEachNode((node) => {
        if (node.group && node.rowGroupColumn) {
          const groupKeys = [
            node.rowGroupColumn.getColId(),
            ...Object.keys(node.aggData || {}),
          ];

          for (const key of groupKeys) {
            if (hiddenColIds.includes(key)) {
              hiddenColIds.splice(hiddenColIds.indexOf(key), 1);
            }
          }
        }
        getSelectedRangeData(node, {
          selectedRowNodes,
          isServerSide: true,
          filterFn: (key, value) =>
            !(hiddenColIds.includes(key) || key.startsWith("ag-Grid-AutoColumn")) &&
            typeof value !== "object",
        });
      });

      addWidgetFullData(selectedRowNodes, ssmRequest, options);
    },
  );

  return addWidgetData;
}

const ToolPanels = [
  {
    id: "columns",
    labelDefault: "Columns",
    labelKey: "columns",
    iconKey: "columns",
    toolPanel: "agColumnsToolPanel",
  },
];
const SSRGridOptions = {
  statusBar: {
    statusPanels: [
      {
        statusPanel: "agAggregationComponent",
        statusPanelParams: {
          aggFuncs: ["count", "sum", "min", "max", "avg"],
        },
      },
    ],
  },
  sideBar: {
    toolPanels: ToolPanels,
    // delete this or set to null to not show it by default
    defaultToolPanel: "",
  },
} as GridOptions<any>;

export default AgGridSSRTable;
