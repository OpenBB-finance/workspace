import type { UseQueryResult } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanelResizeHandle } from "react-resizable-panels";
import { toast } from "sonner";
import DraggableCard, { SetLoadingOnResize } from "~/components/DraggableCard";
import { useStateReducer } from "~/hooks/useStateReducer";
import { type QueryOptions, useJsonData, useMultipleQueries } from "~/lib/api";
import { useShallowCopilotDataStore } from "~/lib/state/copilotData";
import {
  cn,
  type FileResponse,
  handleFileResponse,
  handleMultiFileResponse,
} from "~/lib/utils";
import { Button } from "../ds/atoms/Button";
import { Checkbox } from "../ds/atoms/Checkbox";
import { Input } from "../ds/atoms/Input";
import { useWidgetParamsPositions } from "../General/Table/NavBar/QueryParams";
import Icon from "../Icon";
import Tooltip from "../Tooltip";
import type { ParamDefT } from "../types";
import { ResizablePanel, ResizablePanelGroup } from "../ui/Resizable";
import { useWidgetContext } from "../Widget.context";
import { FileViewer } from "./Helpers/MultiFileViewer/FileViewer";
import useCopilotDataWidget from "./Helpers/useCopilotDataWidget";

const DEFAULT_SIDEBAR_SIZE = 25;
const MIN_SIDEBAR_SIZE = 10;
const MAX_SIDEBAR_SIZE = 60;

const FIXED_QUERY_OPTIONS = {
  staleTime: 1000 * 60 * 24 * 7,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  retry: 1,
  retryDelay: 1000,
};

interface FileOption {
  label: string;
  value: string;
}

function clampSidebarSize(size: unknown) {
  if (typeof size !== "number" || Number.isNaN(size)) return DEFAULT_SIDEBAR_SIZE;
  return Math.min(Math.max(size, MIN_SIDEBAR_SIZE), MAX_SIDEBAR_SIZE);
}

function MultiFileViewerResizeHandle({
  onDragging,
}: {
  onDragging: (isDragging: boolean) => void;
}) {
  return (
    <PanelResizeHandle
      aria-label="Resize file sidebar"
      className={cn(
        "group relative flex w-1.5 flex-none items-center justify-center rounded-sm",
        "focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1",
      )}
      hitAreaMargins={{ coarse: 4, fine: 1 }}
      onDragging={onDragging}
    >
      <div
        className={cn(
          "h-12 w-px rounded-full bg-light-300 transition-colors",
          "group-hover:bg-brand-lighter dark:bg-dark-500 dark:group-hover:bg-brand-lighter",
        )}
      />
    </PanelResizeHandle>
  );
}

function useJsonDataBackwardCompat<
  RT extends UseQueryResult<Record<string, FileResponse>, Error>,
>(selectorParamName: string, selectorParamValue: string[], fallbackUsed = false) {
  const { url = "", headers = {} } = useWidgetContext()?.widget?.endpoint || {};

  const queryResult = useJsonData<Record<string, FileResponse>>(
    {
      url,
      endpointHeaders: { "Content-Type": "application/json", ...headers },
      method: "POST",
      body: { [selectorParamName]: selectorParamValue },
      responseCb: (response, resolve) =>
        handleMultiFileResponse(selectorParamValue, response).then(resolve),
    },
    {
      ...FIXED_QUERY_OPTIONS,
      enabled: !fallbackUsed && selectorParamValue.length > 0,
    },
  );
  const isFallbackEnabled =
    fallbackUsed || queryResult.error?.message === "Method Not Allowed";

  const fallbackQueryResult = useMultipleQueries<FileResponse>(
    selectorParamValue.map(
      (file: string): QueryOptions<FileResponse> => ({
        url,
        endpointHeaders: headers,
        method: "GET" as const,
        params: { [selectorParamName]: file },
        responseCb: (response, resolve) =>
          handleFileResponse(response).then((data) => resolve(data)),
      }),
    ),
    {
      ...FIXED_QUERY_OPTIONS,
      enabled: isFallbackEnabled,
    },
  );

  if (isFallbackEnabled) {
    const queryResult = fallbackQueryResult.reduce(
      (acc, result, index) => {
        for (const key of ["error", "isLoading"]) {
          if (result[key] && !acc[key]) acc[key] = result[key];
        }
        acc.data[selectorParamValue[index]] = result.data;
        return acc;
      },
      { data: {}, isLoading: false, error: null } as RT,
    );

    return { queryResult, fallbackUsed: true };
  }
  return { queryResult, fallbackUsed: false };
}

type State = {
  search: string;
  allSelected: boolean;
  pendingState: {
    currentFileName?: string | null;
    selectedFiles?: string[] | null;
  };
};

export default function MultiFileViewer() {
  const { updateWidget, widget } = useWidgetContext();
  const [state, dispatch] = useStateReducer<State>({
    search: "",
    allSelected: false,
    pendingState: { currentFileName: null, selectedFiles: null },
  });
  const warningShownRef = useRef(false);

  const { widgetAiSelected, toggleSelectedWidget, setWidgetRuntimeState } =
    useShallowCopilotDataStore((state) => ({
      widgetAiSelected: state?.isWidgetSelected(widget.id),
      toggleSelectedWidget: state?.toggleSelectedWidget,
      setWidgetRuntimeState: state?.setWidgetRuntimeState,
    }));
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    paramName: selectorParamName,
    optionsEndpoint,
    optionsParams,
  } = useMemo(
    () =>
      widget.params?.find(
        (p): p is ParamDefT<"endpoint"> => p.roles?.includes("fileSelector") as any,
      ) ?? ({} as ParamDefT<"endpoint">),
    [widget.params],
  );

  const setPendingState = useCallback(
    (params: State["pendingState"]) =>
      dispatch({ pendingState: (prev) => ({ ...prev, ...params }) }),
    [],
  );

  const optionsRequestOptions = useMemo<QueryOptions<FileOption[]>>(() => {
    const options: QueryOptions = {
      url: optionsEndpoint ?? "",
      endpointHeaders: widget.endpoint?.headers ?? {},
      method: widget.endpoint?.method ?? "GET",
      params: { ...(widget.endpoint?.query ?? {}) },
    };

    const entries = Object.entries(optionsParams ?? {});
    if (entries.length === 0) {
      Object.assign(options.params, {
        ...(widget.storage?.params ?? {}),
        [selectorParamName]: undefined,
      });
      return options;
    }

    for (const [key, value] of entries) {
      if (typeof value === "string" && value.startsWith("$")) {
        const paramKey = value.slice(1);
        if (widget.storage?.params?.[paramKey] !== undefined) {
          options.params[key] = widget.storage?.params[paramKey];
        }
      } else options.params[key] = value;
    }

    return options;
  }, [optionsEndpoint, optionsParams, widget.endpoint, widget.storage.params]);

  const {
    data: fileOptions = [],
    isLoading: isLoadingOptions,
    isError,
    dataUpdatedAt,
  } = useJsonData(optionsRequestOptions, FIXED_QUERY_OPTIONS);

  const currentFile = useMemo<FileOption | undefined>(() => {
    return fileOptions.find((item) => item?.value === widget?.storage?.currentFileName);
  }, [fileOptions, widget?.storage?.currentFileName]);

  const aiFileNames = useMemo(
    () => new Set<string>(widget.storage?.params?.[selectorParamName] ?? []),
    [widget.storage?.params?.[selectorParamName]],
  );

  useEffect(() => {
    if (!currentFile && fileOptions.length > 0) {
      setPendingState({ currentFileName: fileOptions[0].value });
    }
    if (fileOptions.length > 0 && widget?.id) {
      // Store in runtime state for immediate access
      setWidgetRuntimeState(widget.id, {
        fileOptions,
        selectorParamName,
      });
    }
  }, [fileOptions, currentFile]);

  useEffect(() => {
    const { currentFileName, selectedFiles } = state.pendingState;
    if ([currentFileName, selectedFiles].every((v) => v === null)) return;
    queueMicrotask(() => {
      updateWidget((prev) => {
        const newWidget = { ...prev };
        if (currentFileName) {
          newWidget.storage.currentFileName = currentFileName;
        }

        if (selectedFiles) {
          newWidget.storage.params[selectorParamName] = selectedFiles;
        }
        if (fileOptions.length > 0) {
          newWidget.storage.cachedFileOptions = fileOptions;
          newWidget.storage.cachedSelectorParamName = selectorParamName;
        }
        return newWidget;
      });
    });
  }, [state.pendingState]);

  useEffect(() => {
    if (isError || isLoadingOptions || !selectorParamName) return;

    const newAiFileNames = new Set<string>(Array.from(aiFileNames));

    if (widgetAiSelected) {
      if (fileOptions.length > 0) {
        const validFiles = fileOptions.map((option) => option.value);
        for (const file of aiFileNames) {
          if (!validFiles.includes(file)) newAiFileNames.delete(file);
        }

        if (newAiFileNames.size === 0 && currentFile?.value)
          newAiFileNames.add(currentFile.value);
      }
    } else {
      newAiFileNames.clear();
      if (currentFile?.value) newAiFileNames.add(currentFile.value);
    }

    const allSelected = newAiFileNames.size === fileOptions.length;
    dispatch({ allSelected });

    if (newAiFileNames.size === 0) return;
    if (
      newAiFileNames.size === aiFileNames.size &&
      Array.from(newAiFileNames).every((name) => aiFileNames.has(name))
    )
      return; // No change in selection
    setPendingState({
      currentFileName: currentFile.value,
      selectedFiles: Array.from(newAiFileNames),
    });
  }, [
    isLoadingOptions,
    fileOptions,
    aiFileNames,
    widgetAiSelected,
    currentFile?.value,
  ]);

  const filteredOptions = useMemo(() => {
    if (state.search === "") return fileOptions;
    return fileOptions.filter(
      (item) =>
        item?.label?.toLowerCase()?.includes(state.search?.toLowerCase()) ||
        item?.value?.toLowerCase()?.includes(state.search?.toLowerCase()),
    );
  }, [fileOptions, state.search]);

  const toggleAiFileSelection = useCallback(
    (value: string) => {
      const currentSelection = new Set<string>(
        widget.storage?.params?.[selectorParamName] ?? [],
      );

      if (currentSelection.has(value)) {
        currentSelection.delete(value);
      } else {
        currentSelection.add(value);
      }

      if (currentSelection.size === 0) toggleSelectedWidget(widget.id);

      setPendingState({ selectedFiles: Array.from(currentSelection) });
    },
    [selectorParamName, widget.storage?.params?.[selectorParamName]],
  );

  const optionsCheckBoxesMemo = useMemo(
    () => (
      /* 792px for A4 page - 84px for top elements height*/
      <div className="overflow-y-auto max-h-[calc(792px-84px)] flex flex-col gap-1">
        {filteredOptions?.map((item, index) => (
          <div
            key={`${item.value}-${index}-checkbox-container`}
            className="flex flex-row gap-1 items-center"
          >
            {widgetAiSelected && (
              <Checkbox
                id={`${item.value}-${index}-checkbox`}
                key={`${item.value}-${index}-checkbox`}
                onClick={(e) => e.stopPropagation()}
                checked={aiFileNames.has(item.value)}
                onCheckedChange={() => toggleAiFileSelection(item.value)}
                className="h-4 w-4 flex-none"
              />
            )}

            <div
              title={item.label}
              onClick={() => setPendingState({ currentFileName: item.value })}
              className={cn(
                "flex-1 flex items-center gap-2 text-left dark:bg-dark-800 dark:text-dark-100 dark:hover:bg-dark-700",
                "hover:bg-light-200 bg-light-100 text-light-500 rounded px-2 py-[5px] whitespace-nowrap truncate cursor-pointer",
                {
                  "dark:bg-dark-400 dark:text-white bg-light-200 text-light-900":
                    currentFile?.value === item.value,
                },
              )}
            >
              {item.label}
            </div>
          </div>
        ))}
      </div>
    ),
    [
      filteredOptions,
      currentFile,
      aiFileNames,
      toggleAiFileSelection,
      widgetAiSelected,
    ],
  );

  const cardRef = useRef<HTMLDivElement>(null);
  const [cardHeight, setCardHeight] = useState<number | null>(null);
  useEffect(() => {
    if (cardRef.current) {
      setCardHeight(cardRef.current.offsetHeight);
    }

    const observer = new ResizeObserver(() => {
      if (cardRef.current) {
        setCardHeight(cardRef.current.offsetHeight);
      }
    });

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const checkBoxesMemo = useMemo(
    () => (
      <div key="file-options" className="overflow-y-auto h-full">
        {widgetAiSelected && (
          <>
            <div className="obb-divider my-0.5" />
            <div className="flex flex-row gap-1 items-center">
              <Checkbox
                onClick={(e) => e.stopPropagation()}
                checked={state.allSelected}
                onCheckedChange={() => {
                  const selectedFiles = state.allSelected
                    ? []
                    : filteredOptions.map((item) => item.value);

                  dispatch((prev) => ({
                    ...prev,
                    allSelected: !prev.allSelected,
                    pendingState: {
                      ...prev.pendingState,
                      selectedFiles,
                    },
                  }));
                }}
                className="h-4 w-4"
              />
              <div
                key={"select-all"}
                className={cn(
                  "flex-1 flex items-center gap-2 text-left dark:bg-dark-800 dark:text-dark-100 ",
                  " bg-light-100 text-light-500 rounded px-2 py-[5px] whitespace-nowrap truncate",
                )}
              >
                Select All
              </div>
            </div>
            <div className="obb-divider my-0.5" />
          </>
        )}
        {optionsCheckBoxesMemo}
      </div>
    ),
    [filteredOptions, optionsCheckBoxesMemo, widgetAiSelected, state.allSelected],
  );

  const selectorParamValue = useMemo(() => {
    if (currentFile?.value)
      return Array.from(new Set([currentFile.value, ...aiFileNames])).sort();
    return Array.from(aiFileNames).sort();
  }, [currentFile, aiFileNames]);

  const { queryResult, fallbackUsed } = useJsonDataBackwardCompat(
    selectorParamName,
    selectorParamValue,
    warningShownRef.current,
  );

  useEffect(() => {
    if (fallbackUsed && !warningShownRef.current) {
      toast.warning("Deprecated Multi File Viewer widget found", {
        id: "deprecated-multi-file-viewer",
        description: (
          <div>
            More information in the{" "}
            <a
              href="https://docs.openbb.co/workspace/developers/widget-types/file-viewer"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              file viewer docs
            </a>
            .
          </div>
        ),
      });
      warningShownRef.current = true;
    }
  }, [fallbackUsed]);

  const currentFileMemo = useMemo(() => {
    if (!currentFile) return null;
    const { data, isLoading } = queryResult;
    const { aiData = {}, objectUrl } = data?.[currentFile.value] || {};
    const dataType = "data_format" in aiData && aiData.data_format.data_type;
    return (
      <FileViewer
        fileName={currentFile?.value}
        dataType={dataType}
        objectUrl={objectUrl}
        isLoading={isLoading}
      />
    );
  }, [currentFile, queryResult]);

  const aiDataMemo = useMemo<FileResponse[]>(() => {
    const { data, isLoading, error } = queryResult;
    if (isLoading || error) return [];
    return Array.from(aiFileNames)
      .map((filename) => data?.[filename]?.aiData)
      .filter(Boolean) as FileResponse[];
  }, [queryResult]);

  const additionalMetadataMemo = useMemo(() => {
    if (widgetAiSelected) {
      const options = filteredOptions.filter((o) => aiFileNames.has(o.value));
      return { options: { [selectorParamName]: options } };
    }
    return { options: { [selectorParamName]: filteredOptions } };
  }, [filteredOptions, aiFileNames, widgetAiSelected, selectorParamName]);

  useCopilotDataWidget({
    aiData: aiDataMemo,
    aiEnabled: true,
    additionalMetadata: additionalMetadataMemo,
  });

  const onInputChange = useCallback(
    (search: string) => {
      dispatch({ search });
      if (inputRef.current) inputRef.current.value = search;
    },
    [inputRef],
  );

  const { renderRow0Params, renderBelowNavbarRows } = useWidgetParamsPositions();

  const isCollapsed = useMemo(
    () => widget.storage?.collapsedSidebar,
    [widget.storage?.collapsedSidebar],
  );

  const [sidebarSize, setSidebarSize] = useState(() =>
    clampSidebarSize(widget.storage?.multiFileSidebarSize),
  );
  const sidebarSizeRef = useRef(sidebarSize);

  useEffect(() => {
    const storedSize = clampSidebarSize(widget.storage?.multiFileSidebarSize);
    sidebarSizeRef.current = storedSize;
    setSidebarSize(storedSize);
  }, [widget.storage?.multiFileSidebarSize]);

  const onSidebarLayout = useCallback((sizes: number[]) => {
    const nextSidebarSize = clampSidebarSize(sizes[0]);
    sidebarSizeRef.current = nextSidebarSize;
    setSidebarSize(nextSidebarSize);
  }, []);

  const persistSidebarSize = useCallback(() => {
    const nextSidebarSize = sidebarSizeRef.current;
    updateWidget((prev) => ({
      ...prev,
      storage: {
        ...prev.storage,
        multiFileSidebarSize: nextSidebarSize,
      },
    }));
  }, [updateWidget]);

  const viewerHeight = cardHeight ? `${cardHeight - 38}px` : undefined;

  const sidebarMemo = useMemo(
    () => (
      <div className="h-full dark:bg-dark-850 bg-light-50 rounded p-2">
        <Input
          ref={(ref) => (inputRef.current = ref)}
          placeholder="Search files"
          prefix={<Icon id="search" />}
          size="sm"
          className="mb-2 overflow-hidden"
          defaultValue={state.search}
          onChange={onInputChange}
        />
        <div className="flex flex-col gap-1 h-[calc(100%-38px)]">{checkBoxesMemo}</div>
      </div>
    ),
    [checkBoxesMemo, onInputChange, state.search],
  );

  const fileViewerMemo = useMemo(
    () => (
      <div className="h-full dark:bg-dark-850 bg-light-50 rounded p-2 relative">
        <div className="absolute top-[18px] left-2 z-10">
          <Tooltip
            message={
              widget.storage?.collapsedSidebar ? "Expand sidebar" : "Collapse sidebar"
            }
          >
            <Button
              size="xs"
              className="size-8 p-0"
              variant="secondary"
              onClick={() =>
                updateWidget((prev) => ({
                  ...prev,
                  storage: {
                    ...prev.storage,
                    collapsedSidebar: !prev.storage?.collapsedSidebar,
                  },
                }))
              }
            >
              <Icon
                className="size-[14px]"
                id={
                  widget.storage?.collapsedSidebar ? "collapse-right" : "collapse-left"
                }
              />
            </Button>
          </Tooltip>
        </div>
        {currentFileMemo}
      </div>
    ),
    [currentFileMemo, updateWidget, widget.storage?.collapsedSidebar],
  );

  return (
    <DraggableCard
      ref={cardRef}
      extraClassName="overflow-hidden"
      error={isError || fileOptions.length === 0}
      errorMessage="Files not found"
      loading={isLoadingOptions}
      lastUpdated={dataUpdatedAt}
      aiEnabled={true}
      aiData={true}
      elementRightNextToTitle={renderRow0Params}
      elementBelowNavbar={renderBelowNavbarRows}
    >
      <SetLoadingOnResize>
        <div
          className={cn("h-full min-h-0", isCollapsed ? "" : "flex")}
          style={{ height: viewerHeight }}
        >
          {isCollapsed ? (
            fileViewerMemo
          ) : (
            <ResizablePanelGroup
              direction="horizontal"
              className="h-full gap-2.5"
              onLayout={onSidebarLayout}
            >
              <ResizablePanel
                defaultSize={sidebarSize}
                minSize={MIN_SIDEBAR_SIZE}
                maxSize={MAX_SIDEBAR_SIZE}
                className="min-w-0"
                style={{ overflow: "hidden" }}
              >
                {sidebarMemo}
              </ResizablePanel>
              <MultiFileViewerResizeHandle
                onDragging={(isDragging) => {
                  if (!isDragging) persistSidebarSize();
                }}
              />
              <ResizablePanel
                defaultSize={100 - sidebarSize}
                minSize={100 - MAX_SIDEBAR_SIZE}
                className="min-w-0"
                style={{ overflow: "hidden" }}
              >
                {fileViewerMemo}
              </ResizablePanel>
            </ResizablePanelGroup>
          )}
        </div>
      </SetLoadingOnResize>
    </DraggableCard>
  );
}
