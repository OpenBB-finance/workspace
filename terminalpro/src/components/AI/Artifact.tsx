import type { AgChartOptions, AgChartTheme } from "ag-charts-community";
import { AgCharts } from "ag-charts-react";
import { AgGridReact } from "ag-grid-react";
import DOMPurify from "dompurify";
import Markdown from "markdown-to-jsx";
import {
  type CSSProperties,
  type FC,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "~/components/ds/atoms/Button";
import { BaseDialog } from "~/components/ds/dialogs/BaseDialog";
import { DialogTitle } from "~/components/ds/dialogs/Dialog";
import { IFRAME_SRCDOC_SANDBOX_ATTRIBUTES } from "~/lib/constants";
import { getConfig } from "~/lib/runtimeConfig";
import { useShallowAppStore } from "~/lib/state/app";
import {
  type BackendTemplate,
  useShallowBackendConnectorStore,
} from "~/lib/state/backendConnector";
import {
  type ArtifactT,
  type ArtifactType,
  type SnowflakeArtifactT,
  useCopilotStore,
  useShallowCopilotStore,
} from "~/lib/state/copilot";
import { useShallowSidebarStore } from "~/lib/state/sidebar";
import { useShallowThemeStore } from "~/lib/state/theme";
import { useWalkthroughStore } from "~/lib/state/walkthrough";
import { createCustomTemplateTab } from "~/lib/utils/createTemplates";
import { HTML_SANITIZE_CONFIG } from "~/lib/utils/sanitize";
import { ConfirmDialog } from "../ds/dialogs/ConfirmDialog";
import { cn } from "../ds/utils";
import { convertToReadableLabel, getColumnDefs } from "../General/Table/AgGridUtils";
import { useAgThemes } from "../General/Table/Chart/themes";
import {
  createChartArtifactAxes,
  createDefaultSeries,
} from "../General/Table/Chart/utils";
import Icon from "../Icon";
import Tooltip from "../Tooltip";
import type { WidgetT } from "../types";
import {
  buildAppArtifactSource,
  buildWidgetMetadataResolver,
  buildWidgetSourceResolver,
} from "./appArtifactUtils";
import type { CreateWidgetParams } from "./hooks/useCreateWidgetFromArtifact";
import { useShallowAppWidgetsStore } from "./hooks/useGetAppWidgets";
import { dispatchCreate } from "./hooks/utils";
import {
  CodeComponent,
  PreCodeComponent,
  renderRule,
  SQLMarkdown,
} from "./MarkdownOverrides";

export type ArtifactProps<
  T extends ArtifactT["type"] = ArtifactT["type"],
  R extends ArtifactType<T> = ArtifactType<T>,
> = {
  artifact: R;
  inAiMessage?: boolean;
};

type ArtifactActionsProps = {
  onCopy: () => void;
  createWidgetParams: CreateWidgetParams;
  copyTooltip: string;
  createTooltip: string;
  copyClassName?: string;
  copyTestId?: string;
  createTestId?: string;
  onFullscreen?: () => void;
};

const ArtifactActions: FC<ArtifactActionsProps> = ({
  onCopy,
  createWidgetParams,
  copyTooltip,
  createTooltip,
  copyClassName = "",
  copyTestId = "copy-artifact-button",
  createTestId = "create-widget-from-artifact-button",
  onFullscreen,
}) => {
  return (
    <div className="flex items-center justify-end gap-1 pt-1.5 pb-0.5 pr-0.5">
      {onFullscreen && (
        <Tooltip message="View report full screen">
          <button
            data-testid="view-fullscreen-html-button"
            onClick={onFullscreen}
            className="obb-small-navbar-btn"
          >
            <Icon id="maximize-01" className="size-3.5" />
          </button>
        </Tooltip>
      )}
      <Tooltip message={copyTooltip}>
        <button
          data-testid={copyTestId}
          onClick={onCopy}
          className={cn(
            "obb-small-navbar-btn flex items-center justify-center",
            copyClassName,
          )}
        >
          <Icon id="clipboard-icon" className="size-3.5" />
        </button>
      </Tooltip>
      <Tooltip message={createTooltip}>
        <button
          data-testid={createTestId}
          onClick={() => dispatchCreate(createWidgetParams)}
          className="obb-small-navbar-btn flex items-center justify-center"
        >
          <Icon id="solar-widget-add-outline" className="size-3.5" />
        </button>
      </Tooltip>
    </div>
  );
};

const maxHeight = 600;

const HTMLArtifact = memo<ArtifactProps<"html">>(({ artifact, inAiMessage }) => {
  const allowJsExecution = getConfig().data.allowHtmlJsExecution;
  const isHighlighted = useShallowCopilotStore(
    (s) => s.hoveredCitationWidgetId === artifact.name,
  );

  const [iframeHeight, setIframeHeight] = useState<number | null>(null);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const sanitizedContent = useMemo(() => {
    const clean = DOMPurify.sanitize(artifact.content, {
      ...HTML_SANITIZE_CONFIG,
      WHOLE_DOCUMENT: true,
    });

    const injectedStyle =
      "<style>body{margin:0;padding:0}table{display:block;overflow-x:auto;max-width:100%}</style>";

    const injectedScript = allowJsExecution
      ? `<script>
(function(){
  function postHeight(){
    var h=Math.max(document.documentElement.scrollHeight,document.body.scrollHeight);
    parent.postMessage({type:"artifactHeight",height:h},"*");
  }
  postHeight();
  if(typeof ResizeObserver!=="undefined"){
    new ResizeObserver(postHeight).observe(document.body);
  }
})();
</script>`
      : "";

    // Inject style (and script if JS enabled) into the HTML
    if (clean.includes("</head>")) {
      return clean.replace("</head>", `${injectedStyle}${injectedScript}</head>`);
    }
    return `${injectedStyle}${injectedScript}${clean}`;
  }, [artifact.content]);

  const handleIframeLoad = useCallback(() => {
    // When JS enabled, postMessage handles height — contentDocument is null (opaque origin)
    if (allowJsExecution && !inAiMessage) return;

    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc?.body) return;

    const measureHeight = () => {
      const body = iframe?.contentDocument?.body;
      if (body) {
        const docHeight = iframe?.contentDocument?.documentElement?.scrollHeight ?? 0;
        const bodyHeight = body.scrollHeight;
        const newHeight = Math.max(docHeight, bodyHeight);
        setIframeHeight((prev) => (prev === newHeight ? prev : newHeight));
      }
    };

    requestAnimationFrame(() => {
      measureHeight();

      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = new ResizeObserver(() => {
        requestAnimationFrame(measureHeight);
      });
      resizeObserverRef.current.observe(doc.body);
    });
  }, [inAiMessage]);

  useEffect(() => {
    if (!allowJsExecution || !inAiMessage) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type === "artifactHeight") {
        const h = Number(event.data.height);
        if (Number.isFinite(h) && h > 0) {
          setIframeHeight((prev) => (prev === h ? prev : h));
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [inAiMessage]);

  useEffect(() => () => resizeObserverRef.current?.disconnect(), []);

  const iframeStyle = useMemo<CSSProperties>(
    () =>
      iframeHeight !== null
        ? { height: Math.min(iframeHeight, maxHeight) }
        : { minHeight: 50 },
    [iframeHeight],
  );

  return (
    <div
      id={artifact.name}
      className={cn("relative mx-1", {
        "outline-2 outline-brand-main": isHighlighted,
        "dark:bg-dark-400 rounded p-2 bg-light-100": inAiMessage,
        "dark:bg-dark-800 bg-light-50 rounded p-2": !inAiMessage,
      })}
    >
      <iframe
        ref={iframeRef}
        srcDoc={sanitizedContent}
        className="w-full border-0"
        style={iframeStyle}
        sandbox={
          allowJsExecution ? IFRAME_SRCDOC_SANDBOX_ATTRIBUTES : "allow-same-origin" // fine to have allow-same-origin because we dont have js execution (allow-scripts)
        }
        title={artifact.name}
        onLoad={handleIframeLoad}
      />
      <ArtifactActions
        copyTooltip="Copy HTML to clipboard"
        createTooltip="Create widget from HTML"
        copyTestId="copy-html-button"
        createTestId="create-widget-from-html-button"
        onFullscreen={() => setIsFullscreenOpen(true)}
        onCopy={() => {
          navigator.clipboard
            .writeText(artifact.content)
            .then(() => toast.success("HTML copied to clipboard"))
            .catch((err) =>
              toast.error("Failed to copy HTML to clipboard", {
                description: err.message,
              }),
            );
        }}
        createWidgetParams={{
          widgetType: "html",
          content: artifact.content,
          metadata: {
            uuid: artifact.uuid,
            name: artifact.name,
            description: artifact.description,
          },
        }}
      />
      <BaseDialog
        open={isFullscreenOpen}
        onClose={() => setIsFullscreenOpen(false)}
        className="!w-[92vw] !max-w-[92vw] !h-[90vh] !max-h-[90vh] !p-0 !gap-0 flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-general-border-secondary shrink-0">
          <DialogTitle>{artifact.name}</DialogTitle>
        </div>
        <iframe
          srcDoc={sanitizedContent}
          className="w-full flex-1 border-0 min-h-0"
          sandbox={
            allowJsExecution ? IFRAME_SRCDOC_SANDBOX_ATTRIBUTES : "allow-same-origin"
          }
          title={`${artifact.name} — full screen`}
        />
      </BaseDialog>
    </div>
  );
});

const TextArtifact = memo<ArtifactProps<"text">>(({ artifact, inAiMessage }) => {
  const isHighlighted = useShallowCopilotStore(
    (s) => s.hoveredCitationWidgetId === artifact.name,
  );

  // Markdown needs double spaces to create a line break
  const content = useMemo(
    () => artifact.content.replace(/\n/g, "  \n"),
    [artifact.content],
  );

  const markdownOptions = useMemo(
    () => ({
      disableParsingRawHTML: true,
      renderRule,
      overrides: {
        a: (props: any) => {
          return (
            <a {...props} target="_blank" rel="noopener noreferrer">
              {props.children}
            </a>
          );
        },
        p: (props: any) => {
          if (props?.children?.some((child: any) => typeof child === "object")) {
            return <div {...props} />;
          }
          return <p {...props} />;
        },
        code: { component: CodeComponent },
        pre: { component: PreCodeComponent },
      },
    }),
    [],
  );

  return (
    <div
      id={artifact.name}
      className={cn({
        "max-h-[200px] overflow-auto relative flex flex-col items-start py-1 rounded min-w-10 max-w-full mx-1":
          !inAiMessage,
        "outline-2 outline-brand-main": !inAiMessage && isHighlighted,
        "dark:bg-dark-400 rounded p-[3px] bg-light-100": inAiMessage,
        "dark:bg-dark-800 bg-light-50": !inAiMessage,
      })}
    >
      <div
        className={cn({
          "px-2.5 prose-sm !text-xs text-justify": !inAiMessage,
        })}
      >
        <Markdown options={markdownOptions}>{content}</Markdown>
      </div>
      {!inAiMessage && (
        <ArtifactActions
          copyTooltip="Copy text to clipboard"
          createTooltip="Create widget from text"
          copyTestId="copy-text-button"
          createTestId="create-widget-from-text-button"
          onCopy={() => {
            navigator.clipboard
              .writeText(content)
              .then(() => toast.success("Text copied to clipboard"))
              .catch((err) =>
                toast.error("Failed to copy text to clipboard", {
                  description: err.message,
                }),
              );
          }}
          createWidgetParams={{
            widgetType: "text",
            content: content,
            metadata: {
              uuid: artifact.uuid,
              name: artifact.name,
              description: artifact.description,
            },
          }}
        />
      )}
    </div>
  );
});

const defaultColDef = {
  minWidth: 100,
  resizable: true,
  sortable: true,
  filter: true,
  suppressAutoSize: true,
  suppressHeaderMenuButton: true,
};

const TableArtifact = memo<ArtifactProps<"table">>(({ artifact, inAiMessage }) => {
  const theme = useShallowThemeStore((state) => state.theme);
  const decimalDigits = useShallowThemeStore((state) => state.decimalDigits);
  const agTheme = useAgThemes(theme)?.agTheme;

  const isHighlighted = useShallowCopilotStore(
    (s) => s.hoveredCitationWidgetId === artifact.name,
  );

  const { rowData, colDefs, heights, totalHeight } = useMemo(() => {
    if (!(artifact?.content?.length > 0)) return {};

    // Reuse the widget table colDef builder so artifacts inherit the same
    // number formatting (decimalDigits), numeric alignment and humanized
    // headers as dashboard tables. Empty widget => no widget-context renderer.
    const colDefs = getColumnDefs(artifact.content, {}, decimalDigits);

    const heights = { row: 32, header: 32, max: 200 };
    const totalHeight = artifact.content.length * heights.row + heights.header;
    return { rowData: artifact.content, colDefs, heights, totalHeight };
  }, [artifact.content, decimalDigits]);

  if (!rowData) return null;

  return (
    <div
      id={artifact.name}
      className={cn("mt-1 p-[3px]", {
        "outline-2 outline-brand-main rounded": isHighlighted,
        "dark:bg-dark-400 rounded bg-light-100": inAiMessage,
        "dark:bg-dark-800 bg-light-50": !inAiMessage,
      })}
    >
      <div
        className="grid overflow-auto"
        style={{
          height: `${Math.min(totalHeight, heights.max) + 5}px`,
        }}
      >
        <AgGridReact
          className="_ag-grid-artifact"
          theme={agTheme}
          domLayout="normal"
          headerHeight={heights.header}
          rowHeight={heights.row}
          rowData={rowData}
          columnDefs={colDefs}
          defaultColDef={defaultColDef}
          suppressContextMenu={true}
          suppressFieldDotNotation={true}
          alwaysShowVerticalScroll={false}
          alwaysShowHorizontalScroll={true}
          suppressHorizontalScroll={false}
        />
      </div>
      <ArtifactActions
        copyTooltip="Copy table to clipboard"
        createTooltip="Create widget from table"
        copyTestId="copy-table-button"
        createTestId="create-widget-from-table-button"
        onCopy={() => {
          navigator.clipboard
            .writeText(
              artifact.content.map((row) => Object.values(row).join("\t")).join("\n"),
            )
            .then(() => toast.success("Table copied to clipboard"))
            .catch((err) =>
              toast.error("Failed to copy table to clipboard", {
                description: err.message,
              }),
            );
        }}
        createWidgetParams={{
          widgetType: "table",
          content: artifact.content,
          metadata: {
            uuid: artifact.uuid,
            name: artifact.name,
            description: artifact.description,
          },
        }}
      />
    </div>
  );
});

export const ChartArtifact = memo<ArtifactProps<"chart">>(
  ({ artifact, inAiMessage }) => {
    const theme = useShallowThemeStore((state) => state.theme);
    const decimalPlaces = useShallowThemeStore((state) => state.decimalDigits);
    const { customChartThemes, chartThemes } = useAgThemes(theme);

    const isHighlighted = useShallowCopilotStore(
      (s) => s.hoveredCitationWidgetId === artifact.name,
    );

    useEffect(() => {
      useWalkthroughStore.setState({ copilotArtifact: artifact });
    }, [artifact]);

    const chartOptions = useMemo(() => {
      if (!(artifact.content.length > 0 && artifact.chart_params)) return null;
      const { chartType, xKey, yKey, angleKey, calloutLabelKey } =
        artifact.chart_params;

      const isScatter = chartType === "scatter";
      const isPie = chartType === "pie";
      const isDonut = chartType === "donut";

      const chartTheme = customChartThemes[chartThemes[0]];
      const overrides = chartTheme?.overrides || {};

      return {
        data: artifact.content,
        series: isDonut
          ? [
              {
                type: "donut",
                calloutLabelKey: calloutLabelKey,
                angleKey: angleKey,
                innerRadiusRatio: 0.7,
              },
            ]
          : isPie
            ? [
                {
                  type: "pie",
                  angleKey: angleKey,
                  calloutLabelKey: calloutLabelKey,
                },
              ]
            : yKey.map((key) => {
                const series = {
                  ...createDefaultSeries({
                    chartType,
                    getDecimalPlaces: () => decimalPlaces,
                  }),
                  type: chartType,
                  xKey: xKey,
                  yKey: key,
                  xName: convertToReadableLabel(xKey),
                  yName: convertToReadableLabel(key),
                };

                if (isScatter) {
                  return {
                    ...series,
                    title: [series.xName, series.yName].join(" vs "),
                  };
                }

                return series;
              }),
        background: { visible: false },
        padding: { top: 20, bottom: 5, left: 20, right: 20 },
        legend: {
          enabled: true,
          position: "top",
          maxHeight: 50,
          maxWidth: 500,
          spacing: 20,
          item: {
            paddingX: 10,
            paddingY: 3,
            marker: {
              shape: "square",
              size: 11,
            },
          },
        },
        theme: {
          ...chartTheme,
          overrides: {
            ...(chartTheme?.overrides || {}),
            common: {
              ...(overrides?.common || {}),
              title: {
                ...(overrides?.common?.title || {}),
                fontSize: 12,
              },
              axes: createChartArtifactAxes(chartType),
            },
          },
        } as unknown as AgChartTheme<any, unknown>,
        animation: { enabled: false },
        keyboard: { enabled: false },
      } as unknown as AgChartOptions;
    }, [artifact, chartThemes, customChartThemes]);

    const handleCopy = useCallback(() => {
      navigator.clipboard
        .writeText(JSON.stringify(artifact.content, null, 2))
        .then(() => toast.success("Chart data copied to clipboard"))
        .catch((err) =>
          toast.error("Failed to copy chart data", { description: err.message }),
        );
    }, [artifact.content]);

    const createWidgetParams = useMemo<CreateWidgetParams>(
      () => ({
        widgetType: "chart",
        content: artifact.content,
        metadata: {
          uuid: artifact.uuid,
          name: artifact.name,
          description: artifact.description,
          ...artifact.chart_params,
        },
      }),
      [artifact],
    );

    if (!(artifact.content.length > 0 && artifact.chart_params)) return null;

    return (
      <div
        id={artifact.name}
        className={cn("overflow-auto rounded px-1.5", {
          "outline-2 outline-brand-main": isHighlighted,
          "dark:bg-dark-600 bg-light-50": inAiMessage,
          "dark:bg-dark-800 bg-light-50": !inAiMessage,
        })}
      >
        <div className="relative mt-1">
          <div className="grid min-h-[300]">
            <AgCharts className="h-full w-full" options={chartOptions} />
          </div>
          <ArtifactActions
            copyTooltip="Copy chart data"
            createTooltip="Create widget from chart"
            copyClassName="_copy-chart-data-button"
            copyTestId="copy-chart-data-button"
            createTestId="create-widget-from-chart-button"
            onCopy={handleCopy}
            createWidgetParams={createWidgetParams}
          />
        </div>
      </div>
    );
  },
);

export const SnowflakeArtifact = memo<
  ArtifactProps<"snowflake_query" | "snowflake_python">
>(({ artifact, inAiMessage }) => {
  const isQuery = artifact.type === "snowflake_query";

  const isHighlighted = useShallowCopilotStore(
    (s) => s.hoveredCitationWidgetId === artifact.name,
  );
  const currentDashboardId = useShallowSidebarStore(
    (s) => s.activeItem as string | null,
  );
  const { addWidget, getDashboardById } = useShallowAppStore((state) => ({
    addWidget: state.addWidget,
    getDashboardById: state.getTabById,
  }));

  const getAppWidget = useShallowAppWidgetsStore((s) => s.getAppWidget);

  const content = useMemo(
    () => artifact.content.replace(/```(sql|python)|```/g, "").trim(),
    [artifact.content],
  );

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(content)
      .then(() => toast.success("SQL copied to clipboard"))
      .catch((err) => toast.error("Failed to copy SQL", { description: err.message }));
  }, [content]);

  const handleCreateWidget = useCallback(async () => {
    if (!currentDashboardId)
      return toast.error("No active dashboard", {
        description: "Please open a dashboard first",
      });

    const tab = getDashboardById(currentDashboardId);
    if (!tab) return toast.error("Dashboard not found");

    const { widget_uuid, origin, id } = artifact.query_data_source;

    // Find the original widget by UUID
    const originalWidget = tab.data?.widgets?.find((w) => w.id === widget_uuid);
    let widget = originalWidget;

    if (!originalWidget) {
      widget = getAppWidget(id as WidgetT["widgetId"], origin);
      if (!widget) {
        return toast.error("Original widget not found", {
          description: `Widget \`${id}\` not found in dashboard or app widgets`,
        });
      }
    }

    // Clone the widget with updated parameter
    const newWidget = {
      ...structuredClone(widget),
      id: undefined,
      gridData: { w: 40, h: 15, minH: 10, minW: 16 },
      storage: widget?.storage || { params: {} },
    } as WidgetT;

    const paramsKey = isQuery ? "query" : "prompt";

    newWidget.storage = {
      ...newWidget.storage,
      params: {
        ...newWidget.storage?.params,
        [paramsKey]: content,
      },
    };

    if (!isQuery) {
      newWidget.storage.response = undefined;
    }

    try {
      const widgetId = await addWidget(currentDashboardId, newWidget);
      toast.success(`${isQuery ? "SQL" : "Python"} widget added to dashboard`);
      setTimeout(() => {
        const element = document.querySelector(`[data-widget-id="${widgetId}"]`);
        if (element) element.scrollIntoView({ behavior: "smooth" });
      }, 200);
    } catch (err) {
      toast.error("Failed to add widget", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, [currentDashboardId, getDashboardById, artifact, content, addWidget]);

  const innerContent = useMemo(() => {
    return (
      <>
        <SQLMarkdown content={artifact.content} />
        {/* Action buttons - inside, bottom right corner */}
        <div
          className={cn("absolute bottom-2 right-2 flex gap-2 items-center", {
            "bottom-4 right-2": inAiMessage,
          })}
        >
          <Tooltip message={`Copy ${isQuery ? "SQL" : "Python"} to clipboard`}>
            <button
              onClick={handleCopy}
              className="hover:text-black dark:hover:text-white h-3 w-3"
            >
              <Icon
                id="clipboard-icon"
                className="hover:text-black dark:hover:text-white h-3 w-3"
              />
            </button>
          </Tooltip>
          <Tooltip message={`Add ${isQuery ? "SQL" : "Python"} widget to dashboard`}>
            <button
              onClick={handleCreateWidget}
              className="hover:text-black dark:hover:text-white h-3 w-3"
            >
              <Icon
                id="solar-widget-add-outline"
                className="hover:text-black dark:hover:text-white h-3 w-3"
              />
            </button>
          </Tooltip>
        </div>
      </>
    );
  }, [artifact.content, handleCopy, handleCreateWidget, inAiMessage]);

  return (
    <div
      id={artifact.name}
      className={cn("w-full relative", {
        "outline-2 outline-brand-main rounded": isHighlighted,
      })}
    >
      {inAiMessage ? (
        innerContent
      ) : (
        <div
          className={cn("dark:bg-dark-800 bg-light-50 mt-0 mx-0 p-0", {
            "outline-2 outline-brand-main rounded": isHighlighted,
          })}
        >
          {innerContent}
        </div>
      )}
    </div>
  );
});

const AppArtifact = memo<ArtifactProps<"app">>(({ artifact, inAiMessage }) => {
  const navigate = useNavigate();
  const { id: currentDashboard } = useParams();
  const { addTab, items } = useShallowAppStore((state) => ({
    addTab: state.addTab,
    items: state.items,
  }));
  const { apiSources, widgetMetadata } = useShallowBackendConnectorStore((state) => ({
    apiSources: state.apiSources,
    widgetMetadata: state.widgetMetadata,
  }));

  const appArtifactSource = useMemo(() => buildAppArtifactSource(artifact), [artifact]);
  const resolveWidget = useMemo(
    () => buildWidgetMetadataResolver(widgetMetadata),
    [widgetMetadata],
  );
  const [confirmDialog, setConfirmDialog] = useState(false);
  const currentDashboardItem = currentDashboard ? items?.[currentDashboard] : undefined;
  const isInDashboard = !!currentDashboardItem?.data && !currentDashboardItem.isFolder;
  const { app } = artifact;
  const tabs = useMemo(() => Object.values(app.tabs ?? {}), [app.tabs]);
  const widgetCount = useMemo(
    () => tabs.reduce((total, tab) => total + (tab.layout?.length ?? 0), 0),
    [tabs],
  );

  const handleOpen = useCallback(
    async (action: "open" | "update") => {
      if (!isInDashboard && action === "update") {
        // dont allow update if not in a dashboard, since we wouldnt know which dashboard to update
        toast.warning("No active dashboard to update", {
          description: "Please open a dashboard first",
        });
        return;
      }
      try {
        if (action === "open") {
          const {
            isFullscreen,
            setIsFullscreen,
            setIsIntentionallyCollapsed,
            setLastPanelState,
          } = useCopilotStore.getState();

          if (isFullscreen) {
            setIsIntentionallyCollapsed(false);
            setLastPanelState("open");
            setIsFullscreen(false);
          }
        }

        await createCustomTemplateTab({
          addTab,
          navigate,
          items,
          template: app as unknown as BackendTemplate,
          source: appArtifactSource,
          currentDashboard,
          dashboardBehavior: action === "open" ? "new" : "current",
          resolveWidgetSource: buildWidgetSourceResolver(
            artifact.widget_refs ?? [],
            apiSources,
          ),
          resolveWidget,
        });
      } catch (error) {
        toast.error("Failed to open app", {
          description: error instanceof Error ? error.message : "Unexpected error",
        });
      }
    },
    [
      addTab,
      navigate,
      items,
      app,
      appArtifactSource,
      artifact,
      currentDashboard,
      apiSources,
      resolveWidget,
      isInDashboard,
    ],
  );

  return (
    <div
      id={artifact.name}
      data-testid="app-artifact"
      className={cn(
        "@container/app-artifact flex min-w-0 flex-col gap-3 overflow-hidden rounded-md bg-components-chat-copilot-cards-bg p-3 mx-1",
        { "my-1": inAiMessage },
      )}
    >
      <ConfirmDialog
        title="Do you want to update this dashboard?"
        description="This will update the current dashboard with the changes from the app artifact."
        open={confirmDialog}
        confirmButton={
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              handleOpen("update");
              setConfirmDialog(false);
            }}
          >
            Yes, update
          </Button>
        }
        onClose={() => {
          setConfirmDialog(false);
        }}
      />
      <div className="flex items-start gap-2.5">
        <div className="flex min-w-0 flex-col">
          <span className="body-sm-medium text-ds-text-heading truncate">
            {app.name}
          </span>
          {app.description && (
            <span className="body-xs-regular text-ds-text-body line-clamp-2">
              {app.description}
            </span>
          )}
          <span className="body-xs-regular text-ds-text-caption pt-0.5">
            {tabs.length} {tabs.length === 1 ? "tab" : "tabs"} · {widgetCount}{" "}
            {widgetCount === 1 ? "widget" : "widgets"}
          </span>
        </div>
      </div>

      {tabs.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((tab) => (
            <span
              key={tab.id}
              className="inline-flex items-center gap-1 rounded-sm border border-general-border-secondary bg-general-bg-primary px-2 py-0.5 body-xs-regular text-ds-text-body"
            >
              {tab.name}
              <span className="text-ds-text-caption">{tab.layout?.length ?? 0}</span>
            </span>
          ))}
        </div>
      )}

      <div className="flex w-full min-w-0 flex-col items-stretch gap-2 @min-[360px]/app-artifact:flex-row @min-[360px]/app-artifact:flex-wrap @min-[360px]/app-artifact:items-center @min-[360px]/app-artifact:justify-end">
        <Tooltip message="Create a new dashboard with this app.">
          <span className="inline-flex w-full min-w-0 @min-[360px]/app-artifact:w-auto">
            <Button
              size="xs"
              variant="primary"
              className="w-full min-w-0 whitespace-normal @min-[360px]/app-artifact:w-auto"
              onClick={() => handleOpen("open")}
              data-testid="open-app-artifact-button"
            >
              <span className="inline-flex min-w-0 items-center justify-center gap-1.5">
                <Icon id="dashboard-icon" className="size-3.5 shrink-0" />
                <span className="hidden @min-[280px]/app-artifact:inline">
                  Open in new dashboard
                </span>
                <span className="@min-[280px]/app-artifact:hidden">Open</span>
              </span>
            </Button>
          </span>
        </Tooltip>
        <Tooltip
          message={
            "Update current dashboard with changes from the app artifact. This will overwrite any existing widgets in the current dashboard."
          }
        >
          <span className="inline-flex w-full min-w-0 @min-[360px]/app-artifact:w-auto">
            <Button
              size="xs"
              variant="secondary"
              className="w-full min-w-0 whitespace-normal @min-[360px]/app-artifact:w-auto"
              disabled={!isInDashboard}
              onClick={() => setConfirmDialog(true)}
              data-testid="update-current-dashboard-app-artifact-button"
            >
              <span className="inline-flex min-w-0 items-center justify-center gap-1.5">
                <Icon id="edit-03" className="size-3.5 shrink-0" />
                <span className="hidden @min-[280px]/app-artifact:inline">
                  Update current dashboard
                </span>
                <span className="@min-[280px]/app-artifact:hidden">Update</span>
              </span>
            </Button>
          </span>
        </Tooltip>
      </div>
    </div>
  );
});

TextArtifact.displayName = "TextArtifact";
TableArtifact.displayName = "TableArtifact";
ChartArtifact.displayName = "ChartArtifact";
SnowflakeArtifact.displayName = "SnowflakeArtifact";
AppArtifact.displayName = "AppArtifact";
type ComponentMapT = { [K in ArtifactT["type"]]: FC<ArtifactProps<K>> };
const ComponentMap: ComponentMapT = {
  chart: ChartArtifact,
  html: HTMLArtifact,
  snowflake_query: SnowflakeArtifact,
  snowflake_python: SnowflakeArtifact,
  text: TextArtifact,
  table: TableArtifact,
  app: AppArtifact,
};

function getArtifactComponent<T extends ArtifactT["type"]>(props: ArtifactProps<T>) {
  if (props.artifact.type in ComponentMap) {
    const Component = ComponentMap[props.artifact.type] as FC<ArtifactProps<T>>;
    return <Component {...props} key={`artifact-${props.artifact.uuid}-root`} />;
  }
  return null;
}

export function isSnowflakeArtifact(
  artifact: ArtifactT,
): artifact is SnowflakeArtifactT {
  return artifact.type === "snowflake_query" || artifact.type === "snowflake_python";
}

export const Artifact = memo<ArtifactProps>((props) => getArtifactComponent(props));

Artifact.displayName = "Artifact";

export default Artifact;
