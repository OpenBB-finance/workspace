import type {
  GetContextMenuItemsParams,
  GetRowIdParams,
  GridReadyEvent,
  RowDataTransaction,
} from "ag-grid-community";
import { useCallback, useEffect, useMemo, useRef } from "react";
import DraggableCard from "~/components/DraggableCard";
import { useWidgetContext } from "~/components/Widget.context";
import { useJsonData } from "~/lib/api";
import { getColumnDefs, getContextMenuItems } from "./AgGridUtils";
import { AgGridProvider, ensureAgGrid } from "./hooks";
import { useWidgetParamsPositions } from "./NavBar/QueryParams";
import { getTableData, someTruthy } from "./utils";

export function useWebsocketData() {
  const {
    wsEndpoint,
    data: { wsRowIdColumns, table: { columnsDefs } = {} } = {},
    storage: { params } = {},
  } = useWidgetContext()?.widget ?? {};

  const cellChangeColumns = useMemo(() => {
    return columnsDefs
      ?.filter((col) => col.enableCellChangeWs)
      ?.map((col) => col.field);
  }, [columnsDefs]);

  const wsClientRef = useRef<WebSocketGrid | null>(null);

  useEffect(() => {
    if (!someTruthy(...Object.values(params ?? {}))) {
      wsClientRef.current?.close?.();
      wsClientRef.current = null;
      return;
    }
    if (wsClientRef.current?._ws?.readyState === WebSocket.OPEN) {
      wsClientRef.current.send(JSON.stringify({ type: "params", params }));
    }
  }, [params]);

  const onMessage = useCallback(
    (event: MessageEvent, agGrid: GridReadyEvent) => {
      try {
        const newData = JSON.parse(event.data);
        if (!ensureAgGrid(agGrid)) return;

        const data = Array.isArray(newData) ? newData : [newData];
        let params: RowDataTransaction<any> = { add: data };

        if (wsRowIdColumns?.length > 0) {
          params = { update: [] };
          for (const row of data) {
            const rowId = wsRowIdColumns.map((col) => row[col]).join("-");
            const node = agGrid.api?.getRowNode(rowId);
            if (node?.data) {
              const newRow = { ...node.data };
              for (const col of cellChangeColumns ?? []) {
                if (newRow[col] !== undefined && row[col] !== undefined) {
                  newRow[col] = row[col];
                }
              }
              params.update!.push(newRow);
            }
          }
        }

        if (
          (params.add && params.add.length === 0) ||
          (params.update && params.update.length === 0)
        )
          return;

        agGrid.api.applyTransactionAsync(params);
      } catch (e) {
        console.error("Failed to parse live_grid data:", e);
      }
    },
    [wsRowIdColumns, cellChangeColumns],
  );

  const startFeed = useCallback(
    (agGrid: GridReadyEvent) => {
      const client = wsClientRef.current;
      const msg = JSON.stringify({ type: "params", params });

      if (client && client._ws?.readyState === WebSocket.OPEN) {
        client.abort();
        return (wsClientRef.current = client.init(agGrid, onMessage).send(msg));
      }

      const url = wsEndpoint.replace("http", "ws");
      wsClientRef.current = new WebSocketGrid(url).init(agGrid, onMessage, msg);
    },
    [params, wsEndpoint, wsClientRef, onMessage],
  );

  useEffect(() => {
    return () => wsClientRef.current?.close?.();
  }, [wsClientRef]);

  return startFeed;
}

function useWsTableData() {
  const {
    endpoint,
    data: { table: { columnsDefs: columnDefsFromJSON, showAll } = {} } = {},
    storage: { params } = {},
  } = useWidgetContext()?.widget ?? {};

  const options = useMemo(() => {
    const newParams = Object.fromEntries(
      Object.entries({
        ...(endpoint?.query ?? {}),
        ...(params ?? {}),
      }).filter(([_key, value]) => value !== "" && value !== undefined),
    );

    return {
      url: endpoint?.url,
      endpointHeaders: endpoint?.headers ?? {},
      method: endpoint?.method ?? "GET",
      params: newParams,
    };
  }, [endpoint, params]);

  const { data, isLoading, error, dataUpdatedAt, isFetching } = useJsonData(options, {
    refetchOnWindowFocus: false,
  });

  const [rowData, columnDefs] = useMemo(() => {
    if (!data) return [null, []];
    const fakeWidget = {
      external: true,
      data: { table: { showAll, columnsDefs: columnDefsFromJSON } },
    };
    const rowData = getTableData(data, fakeWidget);
    const colDefs = getColumnDefs(rowData, fakeWidget);

    return [rowData, colDefs];
  }, [data, columnDefsFromJSON, showAll]);

  return { rowData, columnDefs, isLoading, error, dataUpdatedAt, isFetching };
}

export default function AgWebSockets() {
  const { id: widgetUuid, data: { wsRowIdColumns } = {} } =
    useWidgetContext()?.widget ?? {};
  const queryData = useWsTableData();

  const contextMenuItems = useCallback(
    (params: GetContextMenuItemsParams) =>
      getContextMenuItems(params, { widgetId: widgetUuid }),
    [widgetUuid],
  );

  const getRowId = useCallback(
    (params: GetRowIdParams) =>
      wsRowIdColumns?.map((col) => params.data?.[col])?.join("-"),
    [wsRowIdColumns],
  );

  const startFeed = useWebsocketData();
  const onGridReady = useCallback(
    (params: GridReadyEvent) => startFeed(params),
    [startFeed],
  );

  const { renderRow0Params, renderBelowNavbarRows } = useWidgetParamsPositions();

  return (
    <DraggableCard
      aiEnabled={true}
      aiData={queryData.rowData}
      loading={queryData.isLoading}
      error={queryData.error}
      lastUpdated={queryData.dataUpdatedAt}
      elementRightNextToTitle={renderRow0Params}
      elementBelowNavbar={renderBelowNavbarRows}
    >
      <div className="grid h-[calc(100%-5px)] min-h-[100px]">
        <AgGridProvider
          rowData={queryData.rowData}
          getContextMenuItems={contextMenuItems}
          columnDefs={queryData.columnDefs}
          getRowId={wsRowIdColumns ? getRowId : undefined}
          suppressModelUpdateAfterUpdateTransaction={!wsRowIdColumns?.length}
          onGridReady={onGridReady}
        />
      </div>
    </DraggableCard>
  );
}

export class WebSocketGrid {
  _ws: WebSocket | null = null;
  _connectionString: string | URL;

  _agGrid: GridReadyEvent | null = null;
  _abortController: AbortController | null = null;

  constructor(connectionString: string | URL) {
    this._connectionString = connectionString;
  }

  get ws(): WebSocket | null {
    return this._ws;
  }

  init(
    agGrid: GridReadyEvent,
    onMessage: (msg: MessageEvent, agGrid: GridReadyEvent) => void,
    onOpenMsg?: string,
  ) {
    this._agGrid = agGrid;
    if (!this._ws) {
      this._abortController = this._abortController ?? new AbortController();
      this._ws = new WebSocket(this._connectionString);
    }

    if (this._abortController?.signal?.aborted) {
      this._abortController = new AbortController();
    }

    if (onOpenMsg)
      this.onOpenSync((_e, ws) => {
        ws.send(onOpenMsg);
      });
    this.onMessageSync(onMessage);
    this.onErrorSync((_e) => {});

    return this;
  }

  abort() {
    this._abortController?.abort?.();
  }

  onErrorSync(cb: (e: Event) => void): void {
    this._ws.addEventListener(
      "error",
      (e) => {
        console.error("websocket error", e);

        cb?.(e);
      },
      { signal: this._abortController?.signal },
    );
  }

  onMessageSync(cb: (msg: MessageEvent, agGrid: GridReadyEvent) => void): void {
    this._ws.addEventListener(
      "message",
      (e) => {
        cb?.(e, this._agGrid);
      },
      { signal: this._abortController?.signal },
    );
  }

  onOpenSync(cb: (e: Event, ws: WebSocket) => void): void {
    this._ws.addEventListener(
      "open",
      (e) => {
        cb?.(e, this._ws);
      },
      { signal: this._abortController?.signal },
    );
  }

  send(msg: string) {
    this._ws?.send(msg);

    return this;
  }

  close() {
    this._ws?.close();
    this._ws = null;
  }
}
