import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DraggableCard from "~/components/DraggableCard";
import { getColumnDefs } from "~/components/General/Table/AgGridUtils";
import { AgGridProvider, Table } from "~/components/General/Table/hooks";
import { useWidgetParamsPositions } from "~/components/General/Table/NavBar/QueryParams";
import { getTableData } from "~/components/General/Table/utils";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import { useWidgetContext } from "~/components/Widget.context";
import { useParamGroupBindings } from "~/components/Widgets/Helpers/useParamGroupBindings";
import { type QueryOptions, useJsonData } from "~/lib/api";
import { IFRAME_SRCDOC_SANDBOX_ATTRIBUTES } from "~/lib/constants";
import { getConfig } from "~/lib/runtimeConfig";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn, triggerCustomEvent, useEventListener } from "~/lib/utils";
import {
  type OpenBBWidgetParamValue,
  parseIframeParamsMessage,
  stringifyParamValue,
  WIDGET_PARAM_MESSAGE_TYPES,
} from "~/types/iframeProtocol";

const BRIDGE_TOKEN_FIELD = "openbbWidgetParamBridgeToken";
const RAW_DATA_STALE_TIME = 0;

function getWidgetParamBridgeToken(data: unknown) {
  if (!data || typeof data !== "object") return undefined;
  const token = (data as Record<string, unknown>)[BRIDGE_TOKEN_FIELD];
  return typeof token === "string" ? token : undefined;
}

/**
 * Builds the inline `<script>` injected into HtmlViewer's srcDoc so the inner
 * page can dispatch CustomEvents that get forwarded to the parent via
 * postMessage. The unique `token` lets the parent confirm a forwarded message
 * came from this widget's iframe (belt-and-braces on top of `event.source`).
 * Forwarded message types are kept in sync with WIDGET_PARAM_MESSAGE_TYPES.
 */
function createWidgetParamBridgeScript(token: string) {
  const tokenJson = JSON.stringify(token).replace(/</g, "\\u003c");
  const eventTypesJson = JSON.stringify(WIDGET_PARAM_MESSAGE_TYPES).replace(
    /</g,
    "\\u003c",
  );
  return `<script>(()=>{const token=${tokenJson};const types=${eventTypesJson};const forward=(event)=>{const detail=event&&event.detail;if(!detail||typeof detail!=="object")return;window.parent?.postMessage({...detail,${BRIDGE_TOKEN_FIELD}:token},"*")};for(const t of types)window.addEventListener(t,forward);})();</script>`;
}

function injectWidgetParamBridge(html: string, token: string) {
  const bridge = createWidgetParamBridgeScript(token);
  if (/<body(\s|>)/i.test(html)) {
    return html.replace(/<body([^>]*)>/i, `<body$1>${bridge}`);
  }
  return `${bridge}${html}`;
}

function filterAllowedParams(
  params: Record<string, OpenBBWidgetParamValue> | undefined,
  allowedParams: Set<string>,
) {
  return Object.fromEntries(
    Object.entries(params ?? {}).filter(([paramName]) => allowedParams.has(paramName)),
  );
}

export default function HtmlViewer() {
  const allowJsExecution = getConfig().data.allowHtmlJsExecution;
  const { widget, widgetFromJSON, updateWidget } = useWidgetContext();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeBridgeTokenRef = useRef(`openbb-html-${crypto.randomUUID()}`);
  const iframeEventCleanupRef = useRef<(() => void) | null>(null);
  const latestIframeParamsRef = useRef<Record<string, OpenBBWidgetParamValue>>({});
  const theme = useShallowThemeStore((s) => s.theme);

  // Static HTML mode: content stored directly in widget.storage.html (from copilot artifacts)
  const staticHtml: string | undefined = widget?.storage?.html;
  const isStaticMode = !!staticHtml;

  const rawDataView: boolean = widget?.storage?.rawDataView;
  const hasRawFlag = widget?.raw;

  const setRawDataView = useCallback(
    (enabled: boolean) => {
      updateWidget((prev) => ({
        ...prev,
        storage: {
          ...prev.storage,
          rawDataView: enabled,
        },
      }));
    },
    [updateWidget],
  );
  const [rawData, setRawData] = useState(null);

  const options = useMemo(() => {
    const newParams = Object.fromEntries(
      Object.entries({
        ...(widget?.endpoint?.query ?? {}),
        ...(widget?.storage?.params ?? {}),
      }).filter(([_key, value]) => value !== "" && value !== undefined),
    );

    newParams.theme = theme;

    return {
      url: widget.endpoint?.url,
      endpointHeaders: widget.endpoint?.headers ?? {},
      method: widget.endpoint?.method ?? "GET",
      params: newParams,
      asText: true,
      queryKey: widget.runButton
        ? [
            "html",
            widget.id,
            widget.endpoint?.url,
            widget.endpoint?.method ?? "GET",
            JSON.stringify(newParams),
            JSON.stringify(widget.endpoint?.headers ?? {}),
            widget.refreshQuery ?? 0,
          ]
        : undefined,
    } as QueryOptions;
  }, [
    widget.id,
    widget.runButton,
    widget.refreshQuery,
    widget?.endpoint,
    widget?.storage?.params,
    theme,
  ]);

  const allowedFilterParams = useMemo(() => {
    const params = widget?.params ?? widgetFromJSON?.params ?? [];

    return new Set(params.map((param) => param.paramName).filter(Boolean));
  }, [widget?.params, widgetFromJSON?.params]);

  const { updateGroupedParams: updateGroupBindings } = useParamGroupBindings({
    includeDashboardGroups: true,
    filterAllowedParams: true,
  });

  const updateGroupedParams = useCallback(
    (params: Record<string, OpenBBWidgetParamValue>) => {
      updateGroupBindings(
        Object.fromEntries(
          Object.entries(params).map(([paramName, value]) => [
            paramName,
            stringifyParamValue(value),
          ]),
        ),
      );
    },
    [updateGroupBindings],
  );

  const updateIframeParams = useCallback(
    (params: Record<string, OpenBBWidgetParamValue>, refresh = false) => {
      if (Object.keys(params).length === 0) return;

      updateWidget(
        (prev) => ({
          ...prev,
          ...(refresh ? { refreshQuery: Date.now() } : {}),
          storage: {
            ...prev.storage,
            params: {
              ...(prev.storage?.params ?? {}),
              ...params,
            },
          },
        }),
        true,
      );
    },
    [updateWidget],
  );

  const handleIframeParamsData = useCallback(
    (data: unknown) => {
      const parsed = parseIframeParamsMessage(data);
      if (!parsed) return;

      const nextParams = filterAllowedParams(parsed, allowedFilterParams);
      if (Object.keys(nextParams).length === 0) return;

      const mergedParams = {
        ...filterAllowedParams(widget.storage?.params, allowedFilterParams),
        ...latestIframeParamsRef.current,
        ...nextParams,
      };
      latestIframeParamsRef.current = mergedParams;

      triggerCustomEvent(`updateQueryParams-${widget.id}`, mergedParams);
      updateGroupedParams(mergedParams);
      updateIframeParams(mergedParams);
    },
    [
      latestIframeParamsRef,
      allowedFilterParams,
      updateGroupedParams,
      updateIframeParams,
      widget.id,
      widget.storage?.params,
    ],
  );
  const handleIframeParamsDataRef = useRef(handleIframeParamsData);

  useEffect(() => {
    handleIframeParamsDataRef.current = handleIframeParamsData;
  }, [handleIframeParamsData]);

  const attachIframeEventListeners = useCallback(() => {
    if (!allowJsExecution) return;

    iframeEventCleanupRef.current?.();
    iframeEventCleanupRef.current = null;

    const iframeWindow = iframeRef.current?.contentWindow;
    if (!iframeWindow) return;

    const handleIframeEvent = (event: Event) => {
      handleIframeParamsDataRef.current((event as CustomEvent).detail);
    };

    try {
      for (const eventType of WIDGET_PARAM_MESSAGE_TYPES) {
        iframeWindow.addEventListener(eventType, handleIframeEvent);
      }

      iframeEventCleanupRef.current = () => {
        for (const eventType of WIDGET_PARAM_MESSAGE_TYPES) {
          iframeWindow.removeEventListener(eventType, handleIframeEvent);
        }
      };
    } catch {
      iframeEventCleanupRef.current = null;
    }
  }, [allowJsExecution, iframeRef, handleIframeParamsDataRef, iframeEventCleanupRef]);

  useEffect(() => {
    return () => {
      iframeEventCleanupRef.current?.();
      iframeEventCleanupRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!allowJsExecution) return;

    const handleMessage = (event: MessageEvent) => {
      const isCurrentIframe =
        event.source === iframeRef.current?.contentWindow ||
        getWidgetParamBridgeToken(event.data) === iframeBridgeTokenRef.current;
      if (!isCurrentIframe) return;

      handleIframeParamsData(event.data);
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [allowJsExecution, handleIframeParamsData]);

  const {
    data: htmlData,
    isLoading: htmlLoading,
    error: htmlError,
    dataUpdatedAt,
  } = useJsonData(options, {
    enabled: !(rawDataView || isStaticMode),
    staleTime: widget?.staleTime ?? 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
    retryDelay: 1000,
  });

  const rawDataOptions = useMemo(() => {
    if (!hasRawFlag) return options; // Return valid options even if not using raw

    const baseOptions = { ...options };
    baseOptions.params = {
      ...baseOptions.params,
      raw: true,
    };
    baseOptions.asText = false; // Raw data should be JSON, not text
    delete baseOptions.queryKey;

    return baseOptions;
  }, [options, hasRawFlag]);

  const {
    isLoading: rawLoading,
    data: rawDataResponse,
    error: rawError,
  } = useJsonData(rawDataOptions, {
    enabled: (rawDataView && hasRawFlag) === true,
    staleTime: RAW_DATA_STALE_TIME,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
    retryDelay: 1000,
  });

  // In static mode, use the stored HTML directly; otherwise use fetched data
  const data = isStaticMode ? staticHtml : rawDataView ? rawDataResponse : htmlData;
  const isLoading = isStaticMode ? false : rawDataView ? rawLoading : htmlLoading;
  const error = isStaticMode ? null : rawDataView ? rawError : htmlError;
  const iframeData = useMemo(
    () =>
      allowJsExecution && typeof data === "string"
        ? injectWidgetParamBridge(data, iframeBridgeTokenRef.current)
        : data,
    [allowJsExecution, data],
  );

  useEffect(() => {
    if (rawDataResponse && hasRawFlag) {
      const processedRawData = rawDataResponse?.results ?? rawDataResponse;
      setRawData(processedRawData);
    } else if (!hasRawFlag) {
      setRawData(null);
    }
  }, [rawDataResponse, hasRawFlag]);

  const { renderRow0Params, renderBelowNavbarRows } = useWidgetParamsPositions();

  const handleRunParams = useCallback(
    () => updateIframeParams(latestIframeParamsRef.current, true),
    [updateIframeParams, latestIframeParamsRef],
  );
  useEventListener(`runParams-${widget.id}`, handleRunParams);

  const rawDataToggle = useMemo(() => {
    // No raw data toggle in static mode or if no raw flag
    if (isStaticMode || !hasRawFlag) return null;

    return (
      <Tooltip message={`Switch to ${rawDataView ? "HTML" : "raw data"} view`}>
        <button
          onClick={() => setRawDataView(!rawDataView)}
          className={cn("obb-small-navbar-btn", {
            "bg-brand-main! text-white! hover:bg-brand-main!": !rawDataView,
          })}
          aria-label={`Switch to ${rawDataView ? "HTML" : "raw data"} view`}
          id="raw-data-toggle-button"
        >
          <Icon id="plotly-icon" className="h-3.5 w-3.5" />
        </button>
      </Tooltip>
    );
  }, [isStaticMode, hasRawFlag, rawDataView, setRawDataView]);

  const tableNode = useMemo(() => {
    if (!rawDataView) return null;
    const rowData = getTableData(Array.isArray(rawData) ? rawData : [], widget);
    const columnDefs = getColumnDefs(rowData, widget);
    return (
      <Table>
        <AgGridProvider rowData={rowData} columnDefs={columnDefs} />
      </Table>
    );
  }, [rawDataView, rawData, widget?.data?.table?.columnsDefs, widget?.data?.dataKey]);

  return (
    <DraggableCard
      title={widget.name}
      aiEnabled={true}
      aiData={isStaticMode ? staticHtml : hasRawFlag && rawData ? rawData : htmlData}
      elementRightNextToTitle={renderRow0Params}
      elementBelowNavbar={renderBelowNavbarRows}
      extraNavbarElements={rawDataToggle}
      lastUpdated={dataUpdatedAt}
      loading={isLoading}
      error={error || !data}
      errorMessage={widget?.external ? error?.message : "No results found"}
    >
      {rawDataView && rawData
        ? tableNode
        : data && (
            <iframe
              ref={iframeRef}
              srcDoc={iframeData}
              className="w-full h-full border-0"
              sandbox={allowJsExecution ? IFRAME_SRCDOC_SANDBOX_ATTRIBUTES : ""}
              title={widget.name}
              onLoad={attachIframeEventListeners}
            />
          )}
    </DraggableCard>
  );
}
