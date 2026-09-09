import type { AgChartThemeOverrides } from "ag-charts-enterprise";
import type {
  GridState as AgGridState,
  CellClickedEvent,
  CellSelectionChangedEvent,
  ChartModel,
  ChartRef,
  ChartType,
  ColDef,
  ColumnPivotChangedEvent,
  ColumnPivotModeChangedEvent,
  ColumnRowGroupChangedEvent,
  ColumnValueChangedEvent,
  CreateRangeChartParams,
  GridReadyEvent,
  IServerSideGetRowsParams,
  ManagedGridOptions,
  NewColumnsLoadedEvent,
  StateUpdatedEvent,
  VirtualColumnsChangedEvent,
} from "ag-grid-enterprise";

import type {
  AgGridReact,
  AgGridReactProps,
  CustomCellRendererProps,
} from "ag-grid-react";
import type {
  Dispatch,
  ElementRef,
  MutableRefObject,
  ReactNode,
  SetStateAction,
} from "react";
import type { WidgetColumnDefT } from "~/components/types";
import type { DispatchAction } from "~/hooks/useStateReducer";
import type { CreateChartDataProps } from "../Chart/hooks/useCreateChartData";

type ChartData = {
  rowData: any[];
  columnDefs: ColDef[];
  columns: string[];
};

export type ChartDataT = ChartData & {
  widgetId: string;
  transpose: any;
  period: ("annual" | "quarter" | "ttm") | any;
  chartType?: ChartType;
  chartModel?: Partial<ChartModel>;
  isReallyTransposed?: boolean;
};

export declare interface TableProps {
  children: ReactNode;
}

export type AgGridEvents =
  | NewColumnsLoadedEvent
  | GridReadyEvent
  | StateUpdatedEvent
  | VirtualColumnsChangedEvent
  | CellSelectionChangedEvent
  | IServerSideGetRowsParams
  | ColumnRowGroupChangedEvent
  | ColumnPivotChangedEvent
  | ColumnValueChangedEvent
  | ColumnPivotModeChangedEvent
  | CellClickedEvent;

export interface AgGridElement extends ElementRef<typeof AgGridReact> {}
export declare type GridStateT = Partial<ManagedGridOptions> & {
  gridReady?: boolean;
  needsUpdate?: boolean;
  resized?: { from?: number; to?: number };
  chartThemeOverrides?: AgChartThemeOverrides;
  dataRevision?: number | null;
};

export declare type AgGridContextValue = {
  gridRef: MutableRefObject<AgGridElement>;
  chartRef: MutableRefObject<ChartRef>;
  chartViewElementRef: MutableRefObject<HTMLDivElement>;
  columnDefsRef: MutableRefObject<ColDef[]>;
  columnVisibility?: Record<string, boolean>;
  gridState?: GridStateT;
  getGridState: () => GridStateT;
  updateAgGrid: (
    state: DispatchAction<GridStateT> | ((prev: GridStateT) => GridStateT),
  ) => void;
  setColumnVisibility?: Dispatch<SetStateAction<Record<string, boolean>>>;
  createChartData?: (props: CreateChartDataProps) => ChartDataT;
  createRangeChartParamsCbRef?: MutableRefObject<
    (params: CreateRangeChartParams) => CreateRangeChartParams
  >;
  handleChartViewToggleRef?: MutableRefObject<(chartView: boolean) => boolean>;
  flushColumnStateRef?: MutableRefObject<() => void>;
  previousChartEnabledRef?: MutableRefObject<boolean | undefined>;
  isReallyTransposedRef?: MutableRefObject<boolean>;
};

export interface AgGridProps extends AgGridReactProps {
  extraClassName?: string;
  hideHeader?: boolean;
}

export type SavedState = {
  aggregationModel: AgGridState["aggregation"]["aggregationModel"];
  orderedColIds: AgGridState["columnOrder"]["orderedColIds"];
  columnSizingModel: AgGridState["columnSizing"]["columnSizingModel"];
  hiddenColIds: AgGridState["columnVisibility"]["hiddenColIds"];
  leftColIds: AgGridState["columnPinning"]["leftColIds"];
  rightColIds: AgGridState["columnPinning"]["rightColIds"];
  groupColIds: AgGridState["rowGroup"]["groupColIds"];
  expandedRowGroupIds: AgGridState["rowGroupExpansion"]["expandedRowGroupIds"];
  openColumnGroupIds: AgGridState["columnGroup"]["openColumnGroupIds"];
  scroll: AgGridState["scroll"];
  sideBar: AgGridState["sideBar"];
};

export interface CellRendererProps extends CustomCellRendererProps {
  transpose?: boolean;
  widgetColDefs?: { [field: string]: WidgetColumnDefT };
  decimalPlacesToUse?: number;
}

export interface CellOnClickedProps extends CellRendererProps {
  actionType: WidgetColumnDefT["renderFnParams"]["actionType"];
  sendToAgent?: WidgetColumnDefT["renderFnParams"]["sendToAgent"];
  groupBy?: WidgetColumnDefT["renderFnParams"]["groupBy"];
}

export interface CellHoverCardProps extends CellRendererProps {
  hoverCard?: WidgetColumnDefT["renderFnParams"]["hoverCard"];
}

export type TriggerElementProps =
  | CellRendererProps
  | CellHoverCardProps
  | CellOnClickedProps;
