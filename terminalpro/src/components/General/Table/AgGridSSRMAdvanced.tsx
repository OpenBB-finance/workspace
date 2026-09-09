import {
  lazy,
  memo,
  type KeyboardEvent as ReactKeyboardEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ResizableBox, type ResizableBoxProps } from "react-resizable";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { useDebounceValue, useResizeObserver } from "usehooks-ts";
import { v4 as uuidv4 } from "uuid";
import { dispatchCreate } from "~/components/AI/hooks/utils";
import DraggableCard, {
  HideOnResize,
  LoadingElement,
  SetLoadingOnResize,
} from "~/components/DraggableCard";
import { Button } from "~/components/ds/atoms/Button";
import type { SSRMRunCompleteDetail } from "~/components/General/Table/utils";
import { resizeHandle } from "~/components/GridLayout";
import Icon from "~/components/Icon";
import { RefreshDataDialog } from "~/components/RefreshDataDialog";
import Tooltip from "~/components/Tooltip";
import type { WidgetT } from "~/components/types";
import { getDisplayLanguage } from "~/components/ui/monacoLanguageUtils";
import { useWidgetContext } from "~/components/Widget.context";
import { useAutoRefresh } from "~/hooks/useAutoRefresh";
import useIsMobile from "~/hooks/useIsMobile";
import { type StateDispatch, useStateReducer } from "~/hooks/useStateReducer";
import { useShallowCopilotDataStore } from "~/lib/state/copilotData";
import { useShallowThemeStore } from "~/lib/state/theme";
import {
  cn,
  dispatchRunParams,
  triggerCustomEvent,
  useEventListener,
} from "~/lib/utils";
import {
  AgGridSSRTableProvider,
  type SSRMGridConfig,
  useSSRMGridOptions,
} from "./AgGridSSRM";
import { ChartViewButton, ChartViewElement } from "./Chart/AgChartView";
import { useChartToolPanelAction } from "./Chart/hooks/useChartOptions";
import {
  GenerateCodeFooter,
  PromptGeneratorOverlay,
} from "./components/PromptGeneratorOverlay";
import {
  useAgExportFuncs,
  useColumnVisibility,
  useQuickActionsSettings,
} from "./hooks";
import {
  type AutoMetadataUpdateOptions,
  useAutoMetadataUpdate,
} from "./hooks/useAutoMetadataUpdate";
import { useWidgetParamsPositions } from "./NavBar/QueryParams";
import SQLParams from "./SubMenus/SQLParams";
import TableSettings from "./SubMenus/TableSettings";

const MonacoEditor = lazy(() =>
  import("~/components/ui/MonacoEditor").then((m) => ({ default: m.MonacoEditor })),
);
const MarkdownContent = lazy(() =>
  import("~/components/Widgets/custom/Markdown").then((module) => ({
    default: module.MarkdownContent,
  })),
);

const chartCellLimit =
  Number(import.meta.env.VITE_CHART_FROM_TABLE_CELL_LIMIT) || 200000;

const ERROR_TRUNCATE_LIMIT = 100;

export function formatSSRMError(raw: string) {
  const fullError = raw.replace(/\s+/g, " ").trim();
  const truncated = fullError.length > ERROR_TRUNCATE_LIMIT;
  const shortError = truncated
    ? `${fullError.slice(0, ERROR_TRUNCATE_LIMIT)}...`
    : fullError;

  const colonIdx = fullError.indexOf(": ");
  const title = colonIdx > 0 ? fullError.slice(0, colonIdx) : "An error occurred";
  const details = colonIdx > 0 ? fullError.slice(colonIdx + 2) : fullError;

  return { fullError, shortError, title, details };
}

interface RunAttempt {
  query: string;
}

interface PromptWidgetState {
  inputMaxHeight: number;
  forceRefetch: boolean;
  isEditorExpanded: boolean;
  elementMaxHeight: number;
  pendingStorageUpdate?: Partial<WidgetT["storage"]>;
  isResizing: boolean;
  staleParams: boolean;
  refreshDataModal: boolean;
  showPromptOverlay: boolean;
  generatedCode: string | null;
  editSqlParams: boolean;
  editSqlParamsSeed: string[];
  serverError: string | null;
  pendingFixPrompt: string | null;
}

export default function AgGridSSRMAdvanced() {
  const { widget, isPreview, updateWidget } = useWidgetContext();
  const isMobile = useIsMobile();

  const chartView = widget.storage?.chartView?.enabled;

  const decimalDigits = useShallowThemeStore((s) => s.decimalDigits);
  const { setWidgetCopilotDraftParams, beginWidgetCopilotExecution } =
    useShallowCopilotDataStore((s) => ({
      setWidgetCopilotDraftParams: s.setWidgetCopilotDraftParams,
      beginWidgetCopilotExecution: s.beginWidgetCopilotExecution,
    }));

  const decimalDigitsToUse = widget?.storage?.decimalDigits ?? decimalDigits;
  const [decimalDigitsSettings, setDecimalDigitsSettings] =
    useState(decimalDigitsToUse);

  const promptValue = widget.storage?.params?.query || "";

  const runAttemptRef = useRef<RunAttempt | null>(null);

  const exportFns = useAgExportFuncs();
  const quickActions = useQuickActionsSettings();
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
    return [
      quickActions,
      refreshDataSetting,
      ...(chartView ? ChartToolPanelActions : []),
    ];
  }, [chartView, quickActions, refreshDataSetting, ChartToolPanelActions]);

  // Find the query param from params array to get its language
  const effectiveInputType = useMemo(
    () => widget.params?.find((p) => p.paramName === "query")?.language,
    [widget.params],
  );

  const inputRef = useRef<string>(promptValue || null);
  const currentPromptRef = useRef<string>(promptValue || null);
  const staleParamRef = useRef<boolean>(false);
  const pendingRunCompletionRef = useRef(false);
  const pendingRunStartedAtRef = useRef(0);
  const triggerMetadataUpdateRef = useRef<
    (options?: AutoMetadataUpdateOptions) => void
  >(() => {});
  const cardRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  const onRunComplete = useCallback(
    (detail: SSRMRunCompleteDetail) => {
      if (!pendingRunCompletionRef.current) return;

      pendingRunCompletionRef.current = false;
      const { rowData, ...runCompleteDetail } = detail;
      triggerCustomEvent(`runComplete-${widget.id}`, {
        runComplete: true,
        ...runCompleteDetail,
      });

      if (detail.requestSucceeded && detail.hasData) {
        triggerMetadataUpdateRef.current({ rowDataOverride: rowData });
      }
    },
    [pendingRunCompletionRef, triggerMetadataUpdateRef],
  );

  const ssrmGridConfig = useMemo<SSRMGridConfig>(
    () => ({
      suppressDefaultErrorToast: true,
      onError: (serverError: string) => dispatch({ serverError }),
      onRunComplete,
    }),
    [onRunComplete],
  );

  const ssrmGridOptions = useSSRMGridOptions(promptValue, ssrmGridConfig);

  // Auto metadata update hook
  const triggerMetadataUpdate = useAutoMetadataUpdate(
    currentPromptRef,
    ssrmGridOptions?.tableData?.rowData,
  );

  useEffect(() => {
    triggerMetadataUpdateRef.current = triggerMetadataUpdate;
  }, [triggerMetadataUpdate]);

  const [state, dispatch] = useStateReducer<PromptWidgetState>({
    inputMaxHeight: isPreview ? 100 : (widget.storage?.textareaHeight ?? 0),
    forceRefetch: false,
    elementMaxHeight: widget.storage?.elementMaxHeight ?? 0,
    isEditorExpanded: widget.storage?.isEditorExpanded ?? true,
    pendingStorageUpdate: {},
    isResizing: false,
    staleParams: widget.storage?.ssrmDisabled ?? false,
    refreshDataModal: false,
    showPromptOverlay: false,
    generatedCode: null,
    editSqlParams: false,
    editSqlParamsSeed: [],
    serverError: null,
    pendingFixPrompt: null,
  });

  const syncCopilotQueryParamState = useCallback(
    (draftQuery: string, executedQuery?: string) => {
      setWidgetCopilotDraftParams(widget.id, {
        query: draftQuery ?? executedQuery ?? "",
      });
    },
    [setWidgetCopilotDraftParams, widget.id],
  );

  const updateWidgetState = useCallback(
    (prompt: string, isStale?: boolean) => {
      updateWidget((prev) => {
        const { ssrmDisabled, ...restStorage } = prev.storage;
        const newWidget = { ...prev, storage: restStorage };
        if (!(isStale || ssrmDisabled)) newWidget.refreshQuery = Date.now();

        newWidget.storage.params = {
          ...newWidget.storage.params,
          query: prompt,
        };

        if (ssrmDisabled)
          queueMicrotask(() =>
            triggerCustomEvent(`staleParams-${newWidget.id}`, false),
          );

        queueMicrotask(() =>
          beginWidgetCopilotExecution(prev.id, newWidget.storage.params),
        );

        return newWidget;
      });
    },
    [updateWidget, beginWidgetCopilotExecution],
  );

  const toggleEditor = useCallback(() => {
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
          })}
          onClick={toggleEditor}
        >
          <Icon
            id="sql"
            className={cn("h-4 w-4", {
              "text-white": state.isEditorExpanded,
            })}
          />
        </button>
      </Tooltip>
    );
  }, [state.isEditorExpanded, effectiveInputType, toggleEditor, isMobile]);

  // Data fetching

  const startRun = useCallback(() => {
    runAttemptRef.current = { query: inputRef.current };
    dispatch({ forceRefetch: true, serverError: null });
  }, [inputRef, runAttemptRef]);

  const sendRequest = useCallback(async () => {
    pendingRunCompletionRef.current = true;
    pendingRunStartedAtRef.current = Date.now();
    beginWidgetCopilotExecution(widget.id, {
      ...(widget.storage?.params || {}),
      query: inputRef.current,
    });
    updateWidgetState(inputRef.current, staleParamRef.current);

    currentPromptRef.current = inputRef.current;
    dispatch({ forceRefetch: false, staleParams: false });
    syncCopilotQueryParamState(inputRef.current);

    if (staleParamRef.current) {
      triggerCustomEvent(`staleParams-${widget.id}`, false);
      staleParamRef.current = false;
    }
  }, [
    updateWidgetState,
    inputRef,
    currentPromptRef,
    staleParamRef,
    pendingRunCompletionRef,
    pendingRunStartedAtRef,
    syncCopilotQueryParamState,
    widget.id,
  ]);

  useEffect(() => {
    if (!pendingRunCompletionRef.current || ssrmGridOptions?.isLoading) return;

    const { tableData: { rowData } = {}, dataUpdatedAt, error } = ssrmGridOptions;
    const validArray = Array.isArray(rowData);
    const hasResolvedRequest =
      Boolean(error) ||
      ((dataUpdatedAt ?? 0) >= pendingRunStartedAtRef.current && validArray);

    if (!hasResolvedRequest) return;

    onRunComplete({
      requestSucceeded: !error,
      hasData: validArray && rowData.length > 0,
      rowCount: validArray ? rowData.length : 0,
      rowData: validArray ? rowData : undefined,
    });
  }, [onRunComplete, ssrmGridOptions?.error, ssrmGridOptions?.tableData?.rowData]);

  const handleInputChange = useCallback(
    (value: string) => {
      inputRef.current = value;
      triggerCustomEvent(`queryChanged-${widget.id}`, value);
      syncCopilotQueryParamState(value, currentPromptRef.current || "");
      const isStale = currentPromptRef.current !== value;
      if (isStale !== staleParamRef.current) {
        triggerCustomEvent(`staleParams-${widget.id}`, isStale);
        staleParamRef.current = isStale;
        dispatch({ staleParams: isStale });
      }
    },
    [inputRef, currentPromptRef, staleParamRef, syncCopilotQueryParamState, widget.id],
  );

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      if (e.shiftKey && e.key === "Enter") {
        e.preventDefault();
        startRun();
      }
    },
    [startRun],
  );

  useEffect(() => {
    if (state.forceRefetch) sendRequest();
  }, [state.forceRefetch]);

  const handleAutoRefresh = useCallback(() => {
    startRun();
  }, [startRun]);

  useAutoRefresh(widget.storage?.refreshData, handleAutoRefresh);

  const isLoading = ssrmGridOptions?.isLoading;

  const [ssrmDisabled] = useDebounceValue(widget?.storage?.ssrmDisabled, 800);
  const error = state.serverError || ssrmGridOptions?.error?.message;

  const { errorMessage, secondaryMessage } = useMemo(() => {
    if (!(ssrmDisabled || error)) return { errorMessage: null, secondaryMessage: null };
    if (error) {
      const formatted = formatSSRMError(error);
      return {
        errorMessage: formatted?.title ?? error,
        secondaryMessage: formatted?.details ?? null,
      };
    }

    return {
      errorMessage: (
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
      ),
      secondaryMessage: null,
    };
  }, [ssrmDisabled, error, state.isEditorExpanded]);

  const handleFixError = useCallback(() => {
    if (!error) return;
    const { fullError } = formatSSRMError(error);
    const queryAtRun = runAttemptRef.current?.query || promptValue;
    const fixPrompt = `Fix this SQL query that failed with the following error. Return only the corrected SQL.\n\nError: ${fullError}\n\nQuery:\n${queryAtRun}`;
    dispatch({ pendingFixPrompt: fixPrompt, showPromptOverlay: true });
  }, [error, promptValue, runAttemptRef]);

  // UI
  const updateMaxHeight = useCallback(() => {
    if (cardRef.current) {
      const elementMaxHeight = elementRef.current?.offsetHeight;
      const inputMaxHeight = isPreview ? 100 : cardRef.current.offsetHeight - 130;

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
    queueMicrotask(() => updateMaxHeight());
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
  }, [
    debouncedPending,
    state.isEditorExpanded,
    state.isResizing,
    ssrmGridOptions?.tableData?.rowData,
  ]);

  const debouncedStoreHeight = useDebouncedCallback(storeHeight, 500);
  useResizeObserver({ ref: cardRef, onResize: updateMaxHeight });

  useEventListener(`runParams-${widget.id}`, () => startRun());

  // Respond to staleness state requests (used by metadata dialog on open)
  useEventListener(`requestStaleState-${widget.id}`, () => {
    triggerCustomEvent(`staleParams-${widget.id}`, staleParamRef.current);
  });

  const { renderRow0Params, renderBelowNavbarRows } = useWidgetParamsPositions();
  const handleSave = useColumnVisibility(decimalDigitsSettings);

  const resizableProps = useMemo(() => {
    return {
      resizeHandles: isPreview ? [] : ["se"],
      onResizeStop: () => {
        debouncedStoreHeight();
        dispatch({ isResizing: false });
      },
      minConstraints: [100, 100],
      handle: resizeHandle,
      onResizeStart: () => dispatch({ isResizing: true }),
      transformScale: 1,
    } as const satisfies Partial<ResizableBoxProps>;
  }, [debouncedStoreHeight, isPreview]);

  const markdownData = useMemo(() => {
    if (!ssrmGridOptions?.tableData?.rowData) return null;

    const { rowData, columnDefs } = ssrmGridOptions.tableData;
    if (rowData.length > 1 && columnDefs.length >= 1) return null;

    const colDef = columnDefs[0];
    const textField = colDef?.cellDataType === "text" ? colDef?.field : null;

    const content = rowData[0]?.[textField] || "";
    return content?.length > 100 ? content : null;
  }, [ssrmGridOptions?.tableData]);

  const handleCreateQueryWidget = useCallback(() => {
    const query = inputRef.current?.trim();
    if (!query) {
      toast.warning("No query to create widget from");
      return;
    }

    dispatchCreate({
      widgetType: "ssrm_advanced",
      content: query,
      metadata: {
        uuid: uuidv4(),
        name: widget.name || "SQL Query",
        description: widget.description || "SQL query widget",
      },
    });
  }, [widget.name, widget.description]);

  const handleCreateTableWidget = useCallback(() => {
    const rowData = ssrmGridOptions?.tableData?.rowData;
    const columnDefs = ssrmGridOptions?.tableData?.columnDefs;

    if (!rowData || rowData.length === 0) {
      toast.warning("No data to create widget from");
      return;
    }

    const cellCount = rowData.length * (columnDefs?.length || 0);
    if (cellCount > chartCellLimit) {
      toast.error("Dataset too large to create widget", {
        description: `The data contains ${cellCount.toLocaleString()} cells,
        which exceeds the limit of ${chartCellLimit.toLocaleString()} cells.`,
      });
      return;
    }

    dispatchCreate({
      widgetType: "table",
      content: rowData,
      metadata: {
        uuid: uuidv4(),
        name: widget.name || "Table Data",
        description: widget.description || "Table widget from query results",
      },
    });
  }, [ssrmGridOptions?.tableData, widget.name, widget.description]);

  const onQueryCopyToClipboard = useCallback(() => {
    const query = inputRef.current?.trim();
    if (!query) {
      toast.warning("No query to copy");
      return;
    }
    navigator.clipboard
      .writeText(query)
      .then(() => toast.success("Query copied to clipboard"))
      .catch((err) =>
        toast.error("Failed to copy query", {
          description: err.message,
        }),
      );
  }, [inputRef]);

  const onTableCopyToClipboard = useCallback(() => {
    const rowData = ssrmGridOptions?.tableData?.rowData;
    if (!rowData || rowData.length === 0) {
      toast.warning("No data to copy");
      return;
    }
    navigator.clipboard
      .writeText(rowData.map((row) => Object.values(row).join("\t")).join("\n"))
      .then(() => toast.success("Table copied to clipboard"))
      .catch((err) =>
        toast.error("Failed to copy table", {
          description: err.message,
        }),
      );
  }, [ssrmGridOptions?.tableData]);

  useEventListener(`updateQueryParams-${widget?.id}`, (newParams) => {
    if (newParams?.query) handleInputChange(newParams.query);
  });

  const onRunClick = useCallback(() => dispatchRunParams(widget.id), [widget.id]);

  const handleCodeGenerated = useCallback((code: string) => {
    dispatch({ generatedCode: code, showPromptOverlay: false });
  }, []);

  const handleApplyGeneratedCode = useCallback(() => {
    if (state.generatedCode) {
      updateWidgetState(state.generatedCode);
      inputRef.current = state.generatedCode;
      currentPromptRef.current = state.generatedCode;
      syncCopilotQueryParamState(state.generatedCode);
      dispatch({ generatedCode: null, staleParams: false });
    }
  }, [state.generatedCode, updateWidgetState, syncCopilotQueryParamState]);

  const handleCancelGeneratedCode = useCallback(() => {
    dispatch({ generatedCode: null });
  }, []);

  const handlePromptOverlayClose = useCallback(() => {
    dispatch({ showPromptOverlay: false });
  }, []);

  return (
    <DraggableCard
      extraClassName="mb-0.5 min-h-0 overflow-hidden"
      ref={cardRef}
      refreshButtonType="run"
      aiEnabled={true}
      aiData={true}
      elementRightNextToTitle={renderRow0Params}
      elementBelowNavbar={renderBelowNavbarRows}
      lastUpdated={ssrmGridOptions?.dataUpdatedAt}
      showActionsSettings={true}
      onSaveSettings={handleSave}
      settingsDialogClassName="h-fit"
      settingsModalChildren={
        <TableSettings
          decimalDigitsSettings={decimalDigitsSettings}
          setDecimalDigitsSettings={setDecimalDigitsSettings}
        />
      }
      exportFns={exportFns}
      prependNavbarElements={
        <EditSqlParamsButton
          widgetId={widget.id}
          initialQuery={promptValue || ""}
          sqlParamDefs={widget.storage?.sqlParamDefs}
          onOpen={(names) =>
            dispatch({ editSqlParams: true, editSqlParamsSeed: names })
          }
        />
      }
      extraNavbarElements={
        <>
          {editorToggleButton}
          {!!widget?.storage?.chartView && <ChartViewButton />}
        </>
      }
      navbarClassName="mb-0"
      extraSettings={extraSettings}
    >
      <SetLoadingOnResize className="flex h-full min-h-0 flex-col overflow-hidden">
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
            <div ref={textareaRef} className="h-full">
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
                isLoading={isLoading}
                dispatch={dispatch}
                onCopyToClipboard={onQueryCopyToClipboard}
                onRunClick={onRunClick}
                onCreatePromptWidget={handleCreateQueryWidget}
              />
            )}
          </div>
        </div>

        <PromptGeneratorOverlay
          language={effectiveInputType || "sql"}
          visible={state.showPromptOverlay}
          onClose={handlePromptOverlayClose}
          onCodeGenerated={handleCodeGenerated}
          initialPrompt={state.pendingFixPrompt}
          onInitialPromptConsumed={() => dispatch({ pendingFixPrompt: null })}
        />
        <div
          ref={elementRef}
          className={cn("min-h-0 flex-1 flex-grow", {
            "overflow-y-auto": !chartView,
            "border border-general-border-primary bg-general-bg-primary rounded":
              markdownData,
          })}
        >
          <LoadingElement
            className="h-full! py-2"
            loading={isLoading}
            errorMessage={!isLoading ? errorMessage : undefined}
            secondaryMessage={secondaryMessage}
            icon={!!(ssrmGridOptions?.error || state.serverError)}
            errorChildren={
              !ssrmDisabled &&
              secondaryMessage !== "Failed to fetch" && (
                <Button
                  variant="secondary"
                  size="xs"
                  className="mt-3"
                  onClick={handleFixError}
                >
                  <Icon id="sparkles-icon" className="size-3" />
                  Fix error with AI
                </Button>
              )
            }
          >
            {markdownData ? (
              <div
                className="prose-sm text-xs! prose-p:my-1.5 p-2.5 pb-4
                text-ds-text-heading max-w-none [&_*]:!text-inherit [&_table]:w-full
                [&_th]:bg-table-header-bg [&_td]:bg-table-cell-bg
                [&_tr]:border-surface-divider"
              >
                <Suspense fallback={null}>
                  <MarkdownContent content={markdownData} />
                </Suspense>
              </div>
            ) : (
              <div className="h-full flex flex-col">
                {chartView && <ChartViewElement />}
                <div
                  className={cn("relative flex grow", {
                    "min-h-[100px]": !chartView,
                    "h-0 w-0 max-h-0": chartView,
                    "ssrm-advanced-grid-container":
                      !chartView &&
                      state.isEditorExpanded &&
                      ssrmGridOptions?.tableData?.rowData?.length > 0,
                  })}
                >
                  <AgGridSSRTableProvider ssrmGridOptions={ssrmGridOptions} />
                  {!chartView &&
                    state.isEditorExpanded &&
                    ssrmGridOptions?.tableData?.rowData?.length > 0 && (
                      <HideOnResize>
                        <div
                          className="ssrm-advanced-footer-actions absolute bottom-0
                          left-0 z-10 h-[30px] hidden items-center gap-1
                          pointer-events-none"
                        >
                          <Tooltip message="Copy table to clipboard">
                            <button
                              className="obb-small-navbar-btn pointer-events-auto"
                              onClick={onTableCopyToClipboard}
                            >
                              <Icon id="clipboard-icon" className="size-3.5" />
                            </button>
                          </Tooltip>
                          <Tooltip message="Create widget from table">
                            <button
                              className="obb-small-navbar-btn pointer-events-auto"
                              onClick={handleCreateTableWidget}
                            >
                              <Icon
                                id="solar-widget-add-outline"
                                className="size-3.5"
                              />
                            </button>
                          </Tooltip>
                        </div>
                      </HideOnResize>
                    )}
                </div>
              </div>
            )}
          </LoadingElement>
        </div>
      </SetLoadingOnResize>
      <RefreshDataDialog
        open={state.refreshDataModal}
        onClose={() => dispatch({ refreshDataModal: false })}
      />

      {state.editSqlParams && (
        <SQLParams
          open={state.editSqlParams}
          onClose={() => dispatch({ editSqlParams: false, editSqlParamsSeed: [] })}
          seedNames={state.editSqlParamsSeed}
        />
      )}
    </DraggableCard>
  );
}

type EditorFooterProps = {
  showPromptOverlay: boolean;
  staleParams: boolean;
  forceRefetch: boolean;
  isLoading: boolean;
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
    isLoading,
  } = props;
  const isMobile = useIsMobile();

  return (
    <>
      <div className="flex items-center gap-1">
        <Tooltip message="Generate SQL from prompt" hide={isMobile}>
          <button
            className={cn(
              "obb-small-navbar-btn",
              /*{
                "bg-brand-main! text-white!": showPromptOverlay,
              },*/
            )}
            onClick={() => dispatch({ showPromptOverlay: !showPromptOverlay })}
          >
            <Icon id="sparkles-icon" className="size-3.5" />
          </button>
        </Tooltip>
        <Tooltip message="Copy query to clipboard" hide={isMobile}>
          <button className="obb-small-navbar-btn" onClick={onCopyToClipboard}>
            <Icon id="clipboard-icon" className="size-3.5" />
          </button>
        </Tooltip>
        <Tooltip message="Create widget from query" hide={isMobile}>
          <button className="obb-small-navbar-btn" onClick={onCreatePromptWidget}>
            <Icon id="solar-widget-add-outline" className="size-3.5" />
          </button>
        </Tooltip>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-2xs text-ds-text-caption select-none">Shift + Enter</span>
        <Button
          className={cn({ "pulse-box-shadow": staleParams && !forceRefetch })}
          onClick={onRunClick}
          variant="secondary"
          size="xs"
          disabled={forceRefetch || isLoading}
        >
          Run
        </Button>
      </div>
    </>
  );
});

type EditSqlParamsButtonProps = {
  widgetId: string;
  initialQuery: string;
  sqlParamDefs: WidgetT["storage"]["sqlParamDefs"];
  onOpen: (undefinedParams: string[]) => void;
};

// Isolated so keystrokes only re-render this small button via a debounced
// event listener — the parent widget stays off the hot path.
const EditSqlParamsButton = memo(
  ({ widgetId, initialQuery, sqlParamDefs, onOpen }: EditSqlParamsButtonProps) => {
    const [query, setQuery] = useState(initialQuery);
    const setQueryDebounced = useDebouncedCallback(setQuery, 400);
    const isMobile = useIsMobile();

    useEventListener(`queryChanged-${widgetId}`, (value) => {
      setQueryDebounced(typeof value === "string" ? value : "");
    });

    const undefinedParams = useMemo<string[]>(() => {
      const paramRegex = /\{\{\s*([a-zA-Z_]\w*)\s*\}\}/g;
      const used = new Set<string>(Array.from(query.matchAll(paramRegex), (m) => m[1]));
      if (used.size === 0) return [];
      const defined = new Set<string>(
        (sqlParamDefs ?? []).map((p: { paramName: string }) => p.paramName),
      );
      return Array.from(used).filter((name) => !defined.has(name));
    }, [query, sqlParamDefs]);

    const count = undefinedParams.length;
    const tooltip =
      count > 0
        ? `${count} undefined ${count === 1 ? "parameter" : "parameters"}: ${undefinedParams.map((p) => `{{${p}}}`).join(", ")}`
        : "Edit SQL Parameters";

    return (
      <Tooltip message={tooltip} hide={isMobile}>
        <button
          className={cn("obb-small-navbar-btn", {
            "pulse-box-shadow bg-brand-main! text-white": count > 0,
          })}
          onClick={() => onOpen(undefinedParams)}
        >
          <Icon id="pencil-line" className="size-4" />
        </button>
      </Tooltip>
    );
  },
);
