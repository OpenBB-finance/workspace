import { useMutation } from "@tanstack/react-query";
import type * as Plotly from "plotly.js-dist-min";
import {
  lazy,
  memo,
  type KeyboardEvent as ReactKeyboardEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { ResizableBox, type ResizableBoxProps } from "react-resizable";
import { useResizeDetector } from "react-resize-detector";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { useDebounceValue, useResizeObserver } from "usehooks-ts";
import { useAutoRefresh } from "~/hooks/useAutoRefresh";
import useIsMobile from "~/hooks/useIsMobile";
import { type StateDispatch, useStateReducer } from "~/hooks/useStateReducer";
import { cleanSearchParams, convertHeadersToRecord } from "~/lib/api";
import { type Citation, CopilotDataItemSchema } from "~/lib/state/copilot";
import { useShallowCopilotDataStore } from "~/lib/state/copilotData";
import { useShallowThemeStore } from "~/lib/state/theme";
import DARK_CHARTS_TEMPLATE from "~/lib/templates/dark.json";
import LIGHT_CHARTS_TEMPLATE from "~/lib/templates/light.json";
import {
  cn,
  dispatchRunParams,
  processWidgetId,
  triggerCustomEvent,
  useEventListener,
} from "~/lib/utils";
import { formatZodIssues } from "~/lib/utils/validateBackend";
import { formatZodErrorMessage } from "~/utils/zodErrors";
import { dispatchCreate } from "../AI/hooks/utils";
import { Plot } from "../Charting/PlotlyChart";
import DraggableCard, { LoadingElement } from "../DraggableCard";
import { getColumnDefs, getContextMenuItems } from "../General/Table/AgGridUtils";
import { ChartViewButton, ChartViewElement } from "../General/Table/Chart/AgChartView";
import useChartOptions, {
  useChartToolPanelAction,
} from "../General/Table/Chart/hooks/useChartOptions";
import {
  GenerateCodeFooter,
  PromptGeneratorOverlay,
} from "../General/Table/components/PromptGeneratorOverlay";
import { AgGridProvider } from "../General/Table/hooks";
import { useWidgetParamsPositions } from "../General/Table/NavBar/QueryParams";
import { getTableData } from "../General/Table/utils";
import { resizeHandle } from "../GridLayout";
import Icon from "../Icon";
import { RefreshDataDialog } from "../RefreshDataDialog";
import Tooltip from "../Tooltip";
import type { WidgetT } from "../types";
import { getDisplayLanguage } from "../ui/monacoLanguageUtils";
import { useWidgetContext } from "../Widget.context";
import useCopilotDataWidget from "./Helpers/useCopilotDataWidget";

const MonacoEditor = lazy(() =>
  import("../ui/MonacoEditor").then((m) => ({ default: m.MonacoEditor })),
);
const MarkdownContent = lazy(() =>
  import("./custom/Markdown").then((module) => ({
    default: module.MarkdownContent,
  })),
);

interface PromptResponse {
  content: string;
  data_format: {
    data_type: "object";
    parse_as: "text" | "table" | "chart" | "error";
  };
  extra_citations?: Citation[];
}
interface PromptWidgetState {
  inputMaxHeight: number;
  elementMaxHeight: number;
  response: PromptResponse | null;
  forceRefetch: boolean;
  isEditorExpanded: boolean;
  isResizing: boolean;
  staleParams: boolean;
  pendingStorageUpdate?: Partial<WidgetT["storage"]>;
  refreshDataModal: boolean;
  showPromptOverlay: boolean;
  generatedCode: string | null;
}

type ResponseComponentProps = {
  response: PromptResponse | null;
  isEditorExpanded?: boolean;
};

const ERROR_RESPONSE: PromptResponse = {
  content: "",
  data_format: { data_type: "object", parse_as: "error" },
};

const isError = (response: PromptResponse | null) =>
  response?.data_format?.parse_as === "error";

const NoResponse = (
  <div className="min-h-10 pt-2 px-1 text-ds-text-caption">No response available.</div>
);

function RenderResponseError({ content }: { content: string }) {
  if (!content) return NoResponse;

  return (
    <div
      className="flex flex-col gap-2 text-alert-error bg-error-50/40 dark:bg-error-200/10 p-4
      rounded-md border-[1.5px] border-error-100 mt-2 w-[560px] max-w-full"
    >
      <div className="flex items-center gap-2">
        <Icon id="warning-icon" className="h-5 w-5 flex-shrink-0 text-alert-error" />
        <p className="font-bold text-ds-text-heading text-sm leading-[18px]">
          Error in response
        </p>
      </div>
      <div className="text-xs text-ds-text-heading">
        <div className="flex flex-col gap-1 pl-1">
          {formatZodErrorMessage(content, "dark:text-light-100")}
        </div>
      </div>
    </div>
  );
}

type ChartContent = {
  data: Plotly.PlotData[];
  layout: Partial<Plotly.Layout>;
};

const ResponseComponent = memo((props: ResponseComponentProps) => {
  const { response, isEditorExpanded } = props;
  const theme = useShallowThemeStore((state) => state.theme);

  const agChartViewProps = useChartOptions();

  const widget = useWidgetContext().widget;
  const chartView = widget.storage?.chartView?.enabled;
  const showFloatingActions = !chartView && isEditorExpanded;

  const contextMenuItems = useCallback(
    (params) =>
      getContextMenuItems(params, { enableChart: true, widgetId: widget?.id }),
    [],
  );

  const {
    width,
    height,
    ref: chartContainerRef,
  } = useResizeDetector({
    refreshMode: "debounce",
    refreshRate: 50,
  });

  const data = useMemo(() => {
    const parseAs = response?.data_format?.parse_as;
    if (!parseAs || parseAs === "error") return null;

    if (parseAs === "text")
      return { type: "text" as const, content: response?.content };

    let parsedContent = response?.content;
    if (typeof response?.content === "string") {
      try {
        parsedContent = JSON.parse(response.content);
      } catch (error) {
        console.error("Failed to parse content as JSON:", error);
        return null;
      }
    }

    if (parseAs === "table" && Array.isArray(parsedContent)) {
      const rowData = getTableData(parsedContent, { external: true });
      const columnDefs = getColumnDefs(parsedContent, { external: true });

      return { type: "table" as const, content: { rowData, columnDefs } };
    }

    if (parseAs === "chart" && typeof parsedContent === "object") {
      return { type: "chart" as const, content: parsedContent as ChartContent };
    }

    return null;
  }, [response]);

  if (isError(response)) return <RenderResponseError content={response.content} />;

  if (data?.type === "text") {
    if (!data.content || typeof data.content !== "string") return NoResponse;
    return (
      <div className="min-h-10 h-full flex flex-col text-ds-text-body">
        <div className="flex-1 overflow-y-auto mx-1 my-2">
          <Suspense fallback={null}>
            <MarkdownContent content={data.content} />
          </Suspense>
        </div>
        {!widget.isMinimized && (
          <div className="flex items-center gap-1 px-2 py-1.5 border-t border-surface-divider">
            <Tooltip message="Copy to clipboard">
              <button
                data-testid="copy-text-button"
                className="obb-small-navbar-btn"
                onClick={() => {
                  navigator.clipboard
                    .writeText(data.content)
                    .then(() => {
                      toast.success("Copied to clipboard");
                    })
                    .catch((err) => {
                      toast.error("Failed to copy", { description: err.message });
                    });
                }}
              >
                <Icon id="clipboard-icon" className="size-3.5" />
              </button>
            </Tooltip>
            <Tooltip message="Create note widget">
              <button
                data-testid="create-note-widget-button"
                className="obb-small-navbar-btn"
                onClick={() => {
                  dispatchCreate({ widgetType: "text", content: data.content });
                }}
              >
                <Icon id="solar-widget-add-outline" className="size-3.5" />
              </button>
            </Tooltip>
          </div>
        )}
      </div>
    );
  }

  if (data?.type === "table" && typeof data.content === "object") {
    const { rowData, columnDefs } = data.content;
    // Handle empty results
    if (rowData.length === 0) {
      return (
        <div className="min-h-10 pt-2 px-1 text-ds-text-caption flex items-center justify-center">
          <div className="text-center py-8">
            <div className="text-ds-text-body mb-2">No results found</div>
            <div className="text-sm text-ds-text-caption">
              Your query returned 0 rows
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col">
        {chartView && <ChartViewElement />}
        <div
          className={cn("relative flex grow", {
            "min-h-[100px]": !chartView,
            "h-0 w-0 max-h-0": chartView,
          })}
        >
          <AgGridProvider
            rowData={rowData}
            columnDefs={columnDefs}
            getContextMenuItems={contextMenuItems}
            {...agChartViewProps}
          />
        </div>
        {showFloatingActions && (
          <div className="flex items-center gap-1 px-2 py-1.5 border-t border-surface-divider">
            <Tooltip message="Copy table data">
              <button
                data-testid="copy-table-button"
                className="obb-small-navbar-btn"
                onClick={() => {
                  navigator.clipboard
                    .writeText(JSON.stringify(rowData))
                    .then(() => {
                      toast.success("Table copied to clipboard");
                    })
                    .catch((err) => {
                      toast.error("Failed to copy table data", {
                        description: err.message,
                      });
                    });
                }}
              >
                <Icon id="clipboard-icon" className="size-3.5" />
              </button>
            </Tooltip>
            <Tooltip message="Create widget from table">
              <button
                data-testid="create-widget-from-table-button"
                className="obb-small-navbar-btn"
                onClick={() => {
                  dispatchCreate({
                    widgetType: "table",
                    content: rowData,
                    metadata: null,
                  });
                }}
              >
                <Icon id="solar-widget-add-outline" className="size-3.5" />
              </button>
            </Tooltip>
          </div>
        )}
      </div>
    );
  }
  if (data?.type === "chart" && typeof data.content === "object") {
    const chartContent = data.content;

    if (!(chartContent && (chartContent.data || chartContent.layout)))
      return NoResponse;

    return (
      <div ref={chartContainerRef} className="p-2 h-full w-full">
        <Plot
          data={chartContent.data ?? []}
          layout={{
            ...(chartContent.layout ?? {}),
            // @ts-expect-error: Plotly layout template typing is not compatible with current theme templates
            template: theme === "dark" ? DARK_CHARTS_TEMPLATE : LIGHT_CHARTS_TEMPLATE,
            width: width ? width - 16 : undefined,
            height: height ? height - 16 : undefined,
            autosize: true,
          }}
          config={{
            displaylogo: false,
            responsive: true,
            displayModeBar: false,
          }}
        />
      </div>
    );
  }
  return NoResponse;
});

export default function OmniWidget() {
  const { widget, updateWidget } = useWidgetContext();
  const isMobile = useIsMobile();
  const { setWidgetCopilotDraftParams, beginWidgetCopilotExecution } =
    useShallowCopilotDataStore((s) => ({
      setWidgetCopilotDraftParams: s.setWidgetCopilotDraftParams,
      beginWidgetCopilotExecution: s.beginWidgetCopilotExecution,
    }));

  // Find the prompt/query param from params array to get its language/name
  // Default to "prompt" if neither is found for backward compatibility
  const { effectiveInputType, paramName, isRunCodeWidget } = useMemo(() => {
    const inputParam = widget.params?.find(
      (p) => p.paramName === "prompt" || p.paramName === "query",
    );

    const paramName = inputParam?.paramName || "prompt";
    const effectiveInputType = inputParam?.language || "text";
    const isRunCodeWidget = effectiveInputType === "python";
    return { paramName, effectiveInputType, isRunCodeWidget };
  }, [widget.params]);

  const promptValue = widget.storage?.params?.[paramName] || "";
  const inputRef = useRef<string>(promptValue || null);
  const currentPromptRef = useRef<string>(promptValue || null);
  const staleParamRef = useRef<boolean>(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  const [state, dispatch] = useStateReducer<PromptWidgetState>({
    inputMaxHeight: widget.storage?.textareaHeight ?? 0,
    elementMaxHeight: 0,
    response: widget.storage?.response || null,
    forceRefetch: false,
    isEditorExpanded: widget.storage?.isEditorExpanded ?? true,
    pendingStorageUpdate: {},
    isResizing: false,
    staleParams: !widget.storage?.response,
    refreshDataModal: false,
    showPromptOverlay: false,
    generatedCode: null,
  });

  const syncCopilotPromptParamState = useCallback(
    (draftValue: string, executedValue?: string) => {
      setWidgetCopilotDraftParams(widget.id, {
        [paramName]: draftValue ?? executedValue ?? "",
      });
    },
    [setWidgetCopilotDraftParams, widget.id, paramName],
  );

  const chartView = widget.storage?.chartView?.enabled;
  const parseAsTable = state.response?.data_format?.parse_as === "table";
  const ChartToolPanelActions = useChartToolPanelAction();

  const refreshDataSetting = useMemo(
    () => ({
      icon: "refresh-icon" as const,
      id: "refresh-data",
      label: "Refresh Data",
      onClick: () => dispatch({ refreshDataModal: true }),
    }),
    [],
  );

  const extraSettings = useMemo(() => {
    const chartActions = parseAsTable && chartView ? ChartToolPanelActions : [];
    return [refreshDataSetting, ...chartActions];
  }, [chartView, parseAsTable, refreshDataSetting, ChartToolPanelActions]);

  const updateWidgetState = useCallback(
    (response: PromptResponse | null, prompt: string, lastUpdated: number) => {
      updateWidget((prev) => {
        const newWidget = { ...prev };

        newWidget.storage.params[paramName] = prompt;
        newWidget.storage.response = response;
        newWidget.storage.lastUpdated = lastUpdated;

        return newWidget;
      });
    },
    [paramName, updateWidget],
  );

  const updateWidgetCode = useCallback(
    (code: string) => {
      updateWidget((prev) => ({
        ...prev,
        storage: {
          ...prev.storage,
          params: { ...prev.storage.params, [paramName]: code },
        },
      }));
    },
    [paramName, updateWidget],
  );

  const handlePromptOverlayClose = useCallback(() => {
    dispatch({ showPromptOverlay: false });
  }, []);

  const handleCodeGenerated = useCallback((code: string) => {
    dispatch({ generatedCode: code, showPromptOverlay: false });
  }, []);

  const handleApplyGeneratedCode = useCallback(() => {
    if (state.generatedCode) {
      updateWidgetCode(state.generatedCode);
      inputRef.current = state.generatedCode;
      currentPromptRef.current = state.generatedCode;
      syncCopilotPromptParamState(state.generatedCode);
      dispatch({ generatedCode: null, staleParams: false });
    }
  }, [state.generatedCode, updateWidgetCode, syncCopilotPromptParamState]);

  const handleCancelGeneratedCode = useCallback(() => {
    dispatch({ generatedCode: null });
  }, []);

  const toggleEditor = useCallback(() => {
    // Store current height before collapsing
    const updateState = {
      isEditorExpanded: !state.isEditorExpanded,
      pendingStorageUpdate: {},
    } as Partial<PromptWidgetState>;

    if (state.isEditorExpanded && textareaRef.current) {
      updateState.pendingStorageUpdate.textareaHeight =
        textareaRef.current.offsetHeight;
    }

    if (elementRef.current) {
      updateState.elementMaxHeight = elementRef.current.offsetHeight;
    }

    dispatch({
      ...updateState,
      pendingStorageUpdate: (prev) => ({
        ...prev,
        ...updateState.pendingStorageUpdate,
        isEditorExpanded: !state.isEditorExpanded,
      }),
    });
  }, [state.isEditorExpanded, textareaRef, elementRef]);

  const editorToggleButton = useMemo(() => {
    const language = getDisplayLanguage(effectiveInputType);
    return (
      <Tooltip
        message={
          state.isEditorExpanded ? `Hide ${language} editor` : `Show ${language} editor`
        }
        hide={isMobile}
      >
        <button
          className={cn("obb-small-navbar-btn", {
            "bg-brand-main! text-white": state.isEditorExpanded,
            "dark:active:bg-light-70 hover:bg-light-100 active:bg-light-100 dark:hover:bg-dark-400":
              !state.isEditorExpanded,
          })}
          onClick={toggleEditor}
        >
          <Icon
            id={
              language === "Python" ? "edit-py" : language === "SQL" ? "sql" : "edit-05"
            }
            className={cn("h-4 w-4", {
              "text-white": state.isEditorExpanded,
            })}
          />
        </button>
      </Tooltip>
    );
  }, [state.isEditorExpanded, effectiveInputType, toggleEditor, isMobile]);

  // Data fetching
  const { mutateAsync } = useMutation<PromptResponse, Error, Record<string, any>>({
    mutationFn: async (storageParams) => {
      const { [paramName]: input, ...params } = storageParams || {};
      const endpoint = widget?.endpoint;

      console.log("OmniWidget Debug:", {
        params,
        input,
        paramName,
        endpoint: endpoint?.url,
      });

      const { headers, newParams } = convertHeadersToRecord(endpoint?.headers, params);
      const url = cleanSearchParams(endpoint?.url, endpoint?.query);

      console.log("OmniWidget URL:", url);

      const strToBoolMap = { true: true, false: false };
      // Converts boolean strings to actual booleans for post body
      for (const [key, value] of Object.entries(newParams)) {
        if (value === "true" || value === "false") {
          newParams[key] = strToBoolMap[value];
        }
      }

      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ [paramName]: input, ...newParams }),
      }).catch(() => ({ statusText: "Could not connect to the server" }) as Response);

      const errResp = { ...ERROR_RESPONSE };
      const noContent = r.status === 204;

      if (!r.ok || noContent) {
        let error: any = null;

        try {
          error = await r.json();
        } catch (_) {
          errResp.content = r.statusText;
          return errResp;
        }

        const errorDetail = error?.detail || error?.message || error?.error || error;

        const errorMessage =
          typeof errorDetail === "string" ? errorDetail : JSON.stringify(errorDetail);

        errResp.content = errorMessage;
        return errResp;
      }

      try {
        const data = CopilotDataItemSchema.safeParse(await r.json());
        if (!data.success) {
          errResp.content = formatZodIssues(data.error.issues).join("\n\n");
          return errResp;
        }
        return data.data as PromptResponse;
      } catch (err) {
        errResp.content = err?.message || "Failed to parse response";
        return errResp;
      }
    },
  });

  const sendRequest = useCallback(async () => {
    const submittedParams = {
      ...(widget.storage?.params || {}),
      [paramName]: inputRef.current,
    };
    beginWidgetCopilotExecution(widget.id, submittedParams);

    currentPromptRef.current = inputRef.current;
    syncCopilotPromptParamState(inputRef.current);
    if (staleParamRef.current) {
      triggerCustomEvent(`staleParams-${widget.id}`, false);
      staleParamRef.current = false;
    }

    const result = await mutateAsync(submittedParams);

    const response = isError(result) ? null : result;
    const lastUpdated = Date.now();

    dispatch({ response: result, forceRefetch: false, staleParams: false });
    updateWidgetState(response, inputRef.current, lastUpdated);
  }, [
    mutateAsync,
    updateWidgetState,
    inputRef,
    paramName,
    widget.storage?.params,
    currentPromptRef,
    staleParamRef,
    syncCopilotPromptParamState,
    widget.id,
    beginWidgetCopilotExecution,
  ]);

  const handleInputChange = useCallback(
    (value: string) => {
      inputRef.current = value;
      syncCopilotPromptParamState(value, currentPromptRef.current || "");
      const isStale = currentPromptRef.current !== value;
      if (isStale !== staleParamRef.current) {
        triggerCustomEvent(`staleParams-${widget.id}`, isStale);
        staleParamRef.current = isStale;
        dispatch({ staleParams: isStale });
      }
    },
    [inputRef, currentPromptRef, staleParamRef, syncCopilotPromptParamState, widget.id],
  );

  const onKeyDown = useCallback((e: ReactKeyboardEvent) => {
    if (e.shiftKey && e.key === "Enter") {
      e.preventDefault();
      dispatch({ response: null, forceRefetch: true });
    }
  }, []);

  useEffect(() => {
    if (state.forceRefetch) sendRequest();
  }, [state.forceRefetch]);

  const handleAutoRefresh = useCallback(() => {
    dispatch({ forceRefetch: true });
  }, []);

  useAutoRefresh(widget.storage?.refreshData, handleAutoRefresh);

  // UI
  const updateMaxHeight = useCallback(() => {
    if (cardRef.current) {
      const elementMaxHeight = elementRef.current?.offsetHeight;
      const inputMaxHeight = cardRef.current.offsetHeight - 130;

      dispatch({ inputMaxHeight, ...(elementMaxHeight && { elementMaxHeight }) });
    }
  }, [cardRef, elementRef]);

  const storeHeight = useCallback(() => {
    if (textareaRef.current) {
      const textareaHeight = textareaRef.current.offsetHeight;
      if (elementRef.current) {
        const elementHeight = elementRef.current.offsetHeight;
        dispatch({ elementMaxHeight: elementHeight });
      }
      if (textareaHeight < 60) return; // Avoid storing too small heights

      dispatch({
        pendingStorageUpdate: (prev) => ({
          ...prev,
          textareaHeight,
        }),
      });
    }
  }, [textareaRef, elementRef]);

  const [debouncedPending] = useDebounceValue(state.pendingStorageUpdate, 1000);

  useEffect(() => {
    updateMaxHeight();
    if (
      state.pendingStorageUpdate &&
      Object.keys(state.pendingStorageUpdate).length > 0
    ) {
      updateWidget((prev) => {
        const newWidget = { ...prev };
        newWidget.storage = {
          ...newWidget.storage,
          ...state.pendingStorageUpdate,
        };
        return newWidget;
      });
      dispatch({ pendingStorageUpdate: {} });
    }
  }, [debouncedPending, state.isEditorExpanded]);

  const debouncedStoreHeight = useDebouncedCallback(storeHeight, 500);
  useResizeObserver({ ref: cardRef, onResize: updateMaxHeight });

  const responseComponent = useMemo(() => {
    if (!state.response) return null;
    return (
      <ResponseComponent
        response={state.response}
        isEditorExpanded={state.isEditorExpanded}
      />
    );
  }, [state.response, state.isEditorExpanded]);

  useCopilotDataWidget({
    aiData: isError(state.response) ? null : state.response,
    aiEnabled: true,
    captureExecutedParams: true,
  });
  useEventListener(`runParams-${widget.id}`, () =>
    dispatch({ response: null, forceRefetch: true }),
  );

  const resizableProps = useMemo(() => {
    return {
      resizeHandles: ["se"],
      onResizeStop: () => {
        debouncedStoreHeight();
        dispatch({ isResizing: false });
      },
      minConstraints: [100, 100],
      handle: resizeHandle,
      onResizeStart: () => dispatch({ isResizing: true }),
      transformScale: 1,
    } as const satisfies Partial<ResizableBoxProps>;
  }, [debouncedStoreHeight]);

  const { renderRow0Params, renderBelowNavbarRows } = useWidgetParamsPositions();
  const withProse = !(parseAsTable || state.forceRefetch) && state.response;

  const handleCreatePromptWidget = useCallback(() => {
    const content = inputRef.current?.trim();
    if (!content) {
      toast.warning("No content to create widget from");
      return;
    }
    const metadata = { widgetId: widget.widgetId, sourceName: widget.sourceName };

    const widgetInfo = processWidgetId(widget.widgetId, widget.connectionType);
    if (widget.widgetId !== widgetInfo?.cleanWidgetId)
      metadata.sourceName = "Widget Studio";

    console.log("Creating prompt widget from:", { content, metadata });
    dispatchCreate({ widgetType: "run_code", content, metadata });
  }, [widget.widgetId, widget.sourceName]);

  const onCopyToClipboard = useCallback(() => {
    const content = inputRef.current?.trim();
    if (!content) {
      toast.warning("No content to copy");
      return;
    }
    navigator.clipboard
      .writeText(content)
      .then(() => toast.success("Copied to clipboard"))
      .catch((err) => toast.error("Failed to copy", { description: err.message }));
  }, [inputRef]);

  useEventListener(`updateQueryParams-${widget?.id}`, (newParams) => {
    if (newParams?.[paramName]) handleInputChange(newParams[paramName]);
  });

  const onRunClick = useCallback(() => {
    dispatchRunParams(widget.id);
    const hadError = state.response?.data_format?.parse_as === "error";
    if (!hadError) return;

    updateWidget((prev) => ({ ...prev, refreshQuery: Date.now() }));
  }, [state.response?.data_format, widget.id, updateWidget]);

  return (
    <DraggableCard
      extraClassName="mb-0.5"
      ref={cardRef}
      refreshButtonType="run"
      aiEnabled={true}
      aiData={true}
      lastUpdated={widget.storage?.lastUpdated}
      elementRightNextToTitle={renderRow0Params}
      elementBelowNavbar={renderBelowNavbarRows}
      extraNavbarElements={
        <>
          {editorToggleButton}
          {parseAsTable && <ChartViewButton />}
        </>
      }
      navbarClassName="mb-0"
      extraSettings={extraSettings}
    >
      <div className="flex flex-col h-full overflow-hidden">
        <div
          className={cn(
            "relative px-1 flex flex-col gap-1.5 mb-2 mt-auto",
            "rounded border border-general-border-primary",
            { hidden: !state.isEditorExpanded },
          )}
          style={{
            maxHeight: state.inputMaxHeight ? `${state.inputMaxHeight}px` : "auto",
          }}
        >
          <ResizableBox
            axis="y"
            height={200}
            {...resizableProps}
            className="relative transition-all"
          >
            <div
              ref={textareaRef}
              className={cn("h-full", {
                "pointer-events-none": state.generatedCode,
              })}
            >
              {state.isResizing && <LoadingElement className="relative" />}

              <Suspense fallback={null}>
                <MonacoEditor
                  generatedCode={state.generatedCode}
                  value={promptValue || ""}
                  onChange={handleInputChange}
                  onKeyDown={onKeyDown}
                  language={effectiveInputType}
                  height="100%"
                  maxHeight={
                    state.inputMaxHeight ? `${state.inputMaxHeight - 36}px` : undefined
                  }
                  className={cn("border-0", { hidden: state.isResizing })}
                  transparentBackground={true}
                />
              </Suspense>
            </div>
          </ResizableBox>
          <div
            className="flex items-center justify-between gap-2 px-1 py-1.5
            border-t border-surface-divider"
          >
            {state.generatedCode ? (
              <GenerateCodeFooter
                generatedCode={state.generatedCode}
                onApply={handleApplyGeneratedCode}
                onCancel={handleCancelGeneratedCode}
              />
            ) : (
              <EditorFooter
                showPromptOverlay={state.showPromptOverlay}
                staleParams={state.staleParams}
                forceRefetch={state.forceRefetch}
                dispatch={dispatch}
                onCopyToClipboard={onCopyToClipboard}
                onRunClick={onRunClick}
                onCreatePromptWidget={isRunCodeWidget && handleCreatePromptWidget}
              />
            )}
          </div>
        </div>

        <PromptGeneratorOverlay
          language={effectiveInputType || "python"}
          visible={state.showPromptOverlay}
          onClose={handlePromptOverlayClose}
          onCodeGenerated={handleCodeGenerated}
        />

        <div
          ref={elementRef}
          className={cn("flex-1 flex-grow overflow-y-auto", {
            "border border-general-border-primary bg-general-bg-primary rounded":
              withProse,
            "mb-2 px-2 prose dark:prose-invert max-w-none prose-sm !text-sm": withProse,
          })}
        >
          <LoadingElement
            className="h-full! py-2"
            loading={state.forceRefetch}
            errorMessage={
              !(state.response || state.forceRefetch) && (
                <span className="inline-flex items-center gap-1">
                  <span className="font-normal">
                    {state.isEditorExpanded ? (
                      <>
                        Press the <strong>Run</strong> button to execute the query.
                      </>
                    ) : (
                      <>Click the button on the top left to execute the query.</>
                    )}
                  </span>
                </span>
              )
            }
            icon={false}
          >
            {state.response && responseComponent}
          </LoadingElement>
        </div>
      </div>
      <RefreshDataDialog
        open={state.refreshDataModal}
        onClose={() => dispatch({ refreshDataModal: false })}
      />
    </DraggableCard>
  );
}

type EditorFooterProps = {
  showPromptOverlay: boolean;
  staleParams: boolean;
  forceRefetch: boolean;
  dispatch: StateDispatch<PromptWidgetState>;
  onCopyToClipboard: () => void;
  onRunClick: () => void;
  onCreatePromptWidget?: () => void;
};

const EditorFooter = memo((props: EditorFooterProps) => {
  const {
    dispatch,
    onCopyToClipboard,
    onRunClick,
    onCreatePromptWidget,
    showPromptOverlay,
    staleParams,
    forceRefetch,
  } = props;

  return (
    <>
      <div className="flex items-center gap-1">
        <Tooltip message="Generate code from prompt">
          <button
            className={cn(
              "obb-small-navbar-btn text-brand-main dark:text-brand-lighter",
              {
                "bg-brand-main! text-white": showPromptOverlay,
              },
            )}
            onClick={() => dispatch({ showPromptOverlay: (prev) => !prev })}
          >
            <Icon id="sparkles-icon" />
          </button>
        </Tooltip>
        <div className="h-4 w-px bg-surface-divider" />
        <Tooltip message="Copy to clipboard">
          <button className="obb-small-navbar-btn" onClick={onCopyToClipboard}>
            <Icon id="clipboard-icon" className="size-3.5" />
          </button>
        </Tooltip>
        {!!onCreatePromptWidget && (
          <Tooltip message="Create widget from code">
            <button className="obb-small-navbar-btn" onClick={onCreatePromptWidget}>
              <Icon id="solar-widget-add-outline" className="size-3.5" />
            </button>
          </Tooltip>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-2xs text-ds-text-caption">Shift+Enter</span>
        <button
          className={cn(
            "px-2 py-0.5 text-xs font-medium rounded transition-colors",
            "bg-brand-main text-white hover:bg-brand-main/85",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            { "pulse-box-shadow": staleParams && !forceRefetch },
          )}
          onClick={onRunClick}
          disabled={forceRefetch}
        >
          Run
        </button>
      </div>
    </>
  );
});
