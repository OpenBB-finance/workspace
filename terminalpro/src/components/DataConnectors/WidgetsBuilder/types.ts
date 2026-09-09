import type { ChartType } from "ag-grid-community";
import type { ParamDef, WidgetColumnDefT } from "~/components/types";
import type { WidgetId } from "~/components/Widgets";
import type { WidgetVizType } from "~/lib/types/app";
import type { IconId } from "../../Icon.types";

export interface WidgetConfiguration {
  widgetId?: WidgetId;

  name: string;
  description: string;
  endpoint: string;
  type: WidgetVizType;
  category: string;
  subCategory: string;
  runButton: boolean;

  gridData: {
    w: number;
    h: number;
    minW: number;
    minH: number;
    maxW: number;
    maxH: number;
  };

  dataKey: string;
  wsEndpoint: string;
  wsRowIdColumn: string;

  params: ParamDef[];

  enableCharts: boolean;
  showAll: boolean;
  chartViewEnabled: boolean;
  chartType: ChartType;
  columnsDefs: WidgetColumnDefT[];

  refetchInterval: number | false | string;
  dataUpdateDisplay?: string;
  staleTime: number;
  source: string | string[];

  /** @internal use only for creating endpoint with auth headers */
  readonly headers?: Record<string, string>;
  /** @internal use only for existing backend widget */
  readonly sourceId?: string;
  /** @internal use only for existing backend widget */
  readonly sourceName?: string;
}

export interface FormState {
  endpoint: string;
  authRequired: boolean;
  authHeaderKey: string;
  tokenBearer: string;
  isLoading: boolean;
  isDragging: boolean;
  previewData: any;
  error: string | null;
  lastTestedEndpoint: string;
  // UI state
  examplesOpen: boolean;
  isSaving: boolean;
  dataOrigin: "new_endpoint" | "existing_widget";
  selectedBackend: string;
  selectedWidget: string;
  activeConfigTab: "ui" | "json";
  jsonValue: string;
  jsonError: string;
  isUpdatingPreview: boolean;
  showClearConfirm: boolean;
  isGeneratingWithAI: boolean;
}

export interface ExampleWidget {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: IconId;
  formState: Partial<FormState>;
  widgetConfig: Partial<WidgetConfiguration>;
}
