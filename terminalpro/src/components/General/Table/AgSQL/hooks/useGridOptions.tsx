import type {
  GridReadyEvent,
  IServerSideGetRowsParams,
  IServerSideGetRowsRequest,
} from "ag-grid-community";
import isEqual from "lodash.isequal";

import { type Dispatch, useCallback, useEffect, useMemo } from "react";
import { type DBType, getDatabaseRows } from "~/api/dataConnectors";
import { useWidgetContext } from "~/components/Widget.context";
import { useCallbackRef } from "~/hooks/useRefHooks";
import { type DispatchAction, useStateReducer } from "~/hooks/useStateReducer";
import type { Widget } from "~/lib/state/app";
import { useShallowCopilotDataStore } from "~/lib/state/copilotData";
import { useShallowThemeStore } from "~/lib/state/theme";
import { handleWidgetMetadata } from "~/utils/dataConnectorsHelpers";
import { TOTAL_CELL_LIMIT } from "../../AgGrid";
import { getColumnDefs } from "../../AgGridUtils";
import { getTableData } from "../../utils";
import type { AgSQLState } from "./useAgSQLState";

export type WidgetDataState = {
  aiData: any[];
  addedRequests: Pick<IServerSideGetRowsRequest, "startRow" | "endRow">[];
  currentExtRequest: Omit<IServerSideGetRowsRequest, "startRow" | "endRow"> | null;
  startRow: number;
};

type CopilotSnapshotOptions = {
  captureExecutedParams?: boolean;
};

export function useAddCopilotWidgetData() {
  const { widget, widgetFromJSON } = useWidgetContext();
  const widgetMetadata = handleWidgetMetadata(widget);

  const [state, dispatch] = useStateReducer<WidgetDataState>({
    aiData: [],
    addedRequests: [],
    currentExtRequest: null,
    startRow: 0,
  });

  const { name, description, source, metadata } = useMemo(() => {
    const name = widget?.name || widgetFromJSON?.name;
    const description = widget?.description || widgetFromJSON?.description;
    const source = widgetFromJSON?.source || widget?.source;
    const metadata = widgetMetadata || widget?.metadata || widget?.storage?.params;
    return {
      name,
      description,
      source: Array.isArray(source) ? source[0] : source || "",
      metadata,
      ...(widgetMetadata || {}),
      ...(widget?.metadata || {}),
    };
  }, [
    widget?.name,
    widget?.description,
    widget?.widgetId,
    widget?.storage?.params,
    widget?.metadata,
    widgetFromJSON,
  ]);

  const addDataOnDashboardWidget = useShallowCopilotDataStore(
    (state) => state?.addDataOnDashboardWidget,
  );

  const addWidgetFullData = useCallbackRef(
    (data: any[], options: CopilotSnapshotOptions = {}) => {
      const columnCount = Object.keys(data?.[0] || {}).length;
      if (columnCount * data?.length > TOTAL_CELL_LIMIT) return false;

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
        },
      });

      return true;
    },
  );

  const addWidgetData = useCallbackRef(
    (
      pageData: any[],
      request: IServerSideGetRowsRequest,
      options: CopilotSnapshotOptions = {},
    ) =>
      dispatch((prev) => {
        const { startRow, endRow, ...reqRest } = request;

        if (!isEqual(prev.currentExtRequest, reqRest)) {
          prev = { ...prev, aiData: [], addedRequests: [], currentExtRequest: null };
        }

        if (prev.addedRequests.some((r) => isEqual(r, { startRow, endRow }))) {
          return prev;
        }

        const newData = [...prev.aiData, ...pageData];

        if (!addWidgetFullData(newData, options)) return prev;

        return {
          aiData: newData,
          addedRequests: [...prev.addedRequests, { startRow, endRow }],
          currentExtRequest: reqRest,
          startRow,
        };
      }),
  );

  const selectedWidgetIDs = useShallowCopilotDataStore(
    (state) => state?.selectedWidgetIDs,
  );

  useEffect(() => {
    let newAbortController: AbortController = null;
    if (selectedWidgetIDs?.includes(widget.id)) {
      newAbortController = new AbortController();

      getDatabaseRows(
        new URL(widget.endpoint.url),
        {
          startRow: 0,
          endRow: 10_000,
          ...state.currentExtRequest,
        },
        newAbortController.signal,
      ).then((response) => {
        if (!response?.data) return;
        addWidgetFullData(response.data, { captureExecutedParams: false });
        newAbortController = null;
      });
    }

    return () => newAbortController?.abort();
  }, [selectedWidgetIDs, addWidgetFullData]);

  return addWidgetData;
}

export function useGridOptions(dispatch: Dispatch<DispatchAction<AgSQLState>>) {
  const { getWidget, updateWidget } = useWidgetContext();

  const theme = useShallowThemeStore((themeState) => themeState.theme);

  const addData = useAddCopilotWidgetData();
  const beginWidgetCopilotExecution = useShallowCopilotDataStore(
    (state) => state.beginWidgetCopilotExecution,
  );

  const sideBar = useMemo(() => {
    return {
      toolPanels: [
        {
          id: "columns",
          labelDefault: "Columns",
          labelKey: "columns",
          iconKey: "columns",
          toolPanel: "agColumnsToolPanel",
        },
      ],
      // delete this or set to null to not show it by default
      defaultToolPanel: "",
    };
  }, []);

  const DataSource = useMemo(() => {
    return {
      getRows: async (params: IServerSideGetRowsParams) => {
        const widget = getWidget();
        beginWidgetCopilotExecution(widget.id, { ...(widget.storage?.params || {}) });
        const dbType = widget?.connectionType as DBType;

        const response = await getDatabaseRows(
          new URL(widget.endpoint.url),
          params.request,
        ).catch((e) => {
          console.error(e);
          return null;
        });

        if (params?.api?.isDestroyed()) return;

        if (!response?.data) {
          return params.fail();
        }

        if (params.api?.getGridOption("columnDefs")?.length === 0) {
          const rowData = getTableData(response.data, { external: true } as Widget);

          const columnDefs = getColumnDefs(rowData, {
            external: true,
            data: { table: { columnsDefs: [] } },
          } as Widget);

          for (const col of columnDefs) {
            if (col.chartDataType === "category") {
              col.enableRowGroup = true;
              col.enablePivot = true;
            }

            if (col.cellDataType === "number") {
              col.allowedAggFuncs = ["sum", "min", "max", "avg"];
              col.enableValue = true;
              col.enablePivot = true;
            }
          }

          if (dbType === "snowflake" && response?.schema) {
            updateWidget(
              (prev) => ({
                ...prev,
                metadata: {
                  data_interface: "SQL",
                  sql_dialect: "Snowflake",
                  schema: response?.schema,
                },
                storage: {
                  ...prev.storage,
                  SQLparams: {
                    ...(prev.storage?.SQLparams ?? {}),
                  },
                },
              }),
              true,
            );
          }

          dispatch({ columnDefs, rowData });
        }

        const pageSize = params.api.paginationGetPageSize();

        if (response?.data?.length > pageSize) {
          setTimeout(() => {
            params.api.updateGridOptions({
              pagination: response?.data?.length > pageSize,
              paginationAutoPageSize: response?.data?.length < pageSize,
              paginationPageSize:
                widget?.storage?.paginationPageSize ?? response?.data?.length,
            });
          });
        }

        addData(response.data, params.request, {
          captureExecutedParams: true,
        });

        return params.success({
          rowData: response.data,
          rowCount: response.rows,
          pivotResultFields: response.pivotResultFields,
        });
      },
    };
  }, [getWidget, addData, beginWidgetCopilotExecution]);

  const onGridReady = useCallback(
    (params: GridReadyEvent) => {
      params.api!.setGridOption("serverSideDatasource", DataSource);
    },
    [DataSource],
  );

  const gridOptions = useMemo(() => {
    return {
      chartThemes: theme === "dark" ? ["ag-default-dark"] : ["ag-default"],
      rowHeight: 32,
      headerHeight: 32,
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
    };
  }, [theme]);

  return { sideBar, gridOptions, onGridReady };
}
