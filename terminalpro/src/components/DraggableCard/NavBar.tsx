import { InfoCircledIcon } from "@radix-ui/react-icons";
import dayjs from "dayjs";
import { toPng } from "html-to-image";
import { cloneDeep } from "lodash";
import posthog from "posthog-js";
import {
  forwardRef,
  isValidElement,
  memo,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { toast } from "sonner";
import { useDebounceValue } from "usehooks-ts";
import { useCopilotAvailable } from "~/components/AI/hooks/useCopilotAvailable";
import useIsMobile from "~/hooks/useIsMobile";
import { useStateReducer } from "~/hooks/useStateReducer";
import { IMAGE_FILE_EXTENSIONS, inSnowflakeNativeApp } from "~/lib/constants";
import { getConfig } from "~/lib/runtimeConfig";
import { useAppStore, useShallowAppStore } from "~/lib/state/app";
import { useShallowCopilotStore } from "~/lib/state/copilot";
import { useShallowCopilotDataStore } from "~/lib/state/copilotData";
import { useShallowThemeStore } from "~/lib/state/theme";
import {
  cn,
  dispatchRunParams,
  getCellOnClickParams,
  getCleanWidgetId,
  getWidgetDataSource,
  getWidgetInfo,
  isOmniType,
  isSSRMType,
  useEventListener,
} from "~/lib/utils";
import {
  describeCronExpression,
  getNextCronDate,
  getPreviousCronDate,
} from "~/lib/utils/cronSchedule";
import {
  NotificationId,
  showNotification,
  showNotificationWithRememberMe,
} from "~/lib/utils/toast";
import { linkifyText } from "~/utils/linkifyText";
import EllipsisDropdownMenu from "../EllipsisDropdown";
import FunctionsDialog from "../FunctionsDialogDraggableCard";
import { TOTAL_CELL_LIMIT } from "../General/Table/AgGrid";
import Icon from "../Icon";
import type { IconId } from "../Icon.types";
import { MetadataDialog } from "../MetadataDialogDraggableCard";
import { ParametersDialog } from "../ParametersDialogDraggableCard";
import { SettingsDialog } from "../SettingsDialogDraggableCard";
import Tooltip from "../Tooltip";
import { useWidgetContext } from "../Widget.context";
import WidgetFullscreen from "../WidgetFullScreenDraggableCard";
import GroupDropdown from "../Widgets/Helpers/GroupDropdown";

export type DraggableState = {
  isFullscreen: boolean;
  settingsModal: boolean;
  functionsModal: boolean;
  metadataModal: boolean;
  parametersModal: boolean;
  isMinimized: boolean;
};

const initialState: DraggableState = {
  isFullscreen: false,
  settingsModal: false,
  functionsModal: false,
  metadataModal: false,
  parametersModal: false,
  isMinimized: false,
};

export type ExtraAction = {
  label: string;
  onClick?: () => void;
  icon: IconId;
  id: string;
  hide?: boolean;
  tooltipMessage?: string;
  disabled?: boolean;
  showId?: string;
};

export type ExtraActionT = ExtraAction & { children?: ExtraAction[] };

export interface NavBarProps {
  isPreview?: boolean;
  elementBelowNavbar?: ReactNode;
  aiEnabled?: boolean;
  showAIContextButton?: boolean;
  showTitle?: boolean;
  refreshButtonType?: "timer" | "run";
  title?: string;
  loading?: boolean;
  lastUpdated?: number;
  showClose?: boolean;
  showEllipsisMenu?: boolean;
  disableRetrievalForCopilot?: boolean;
  elementBeforeTitle?: ReactNode;
  elementLeftOfTitle?: ReactNode;
  elementNextToTitle?: ReactNode;
  elementRightNextToTitle?: ReactNode;
  elementBelowTitle?: ReactNode;
  tooltipMessage?: string;
  settingsModalChildren?: ReactNode;
  showActionsSettings?: boolean;
  extraActions?: ReactNode;
  onSaveSettings?: () => void;
  setOpenSettings?: (value: boolean) => void;
  openSettings?: boolean;
  extraSettings?: ExtraActionT[];
  extraNavbarElements?: ReactNode;
  prependNavbarElements?: ReactNode;
  onClose?: () => void;
  navbarClassName?: string;
  settings?: {
    showMetadata?: boolean;
    showSettings?: boolean;
    showFunctions?: boolean;
    showParameters?: boolean;
    showShare?: boolean;
    showDuplicate?: boolean;
    showExport?: boolean;
    showMaximize?: boolean;
    showMove?: boolean;
    showCopyToClipboard?: boolean;
    showMinimize?: boolean;
    overrideSettings?: boolean;
  };
  exportFns?: {
    csvFunction?: (title: string) => void;
    excelFunction?: (title: string) => void;
    pngFunction?: (title: string) => void;
    pdfFunction?: (title: string) => void;
    txtFunction?: (title: string) => void;
  };
  settingsDialogClassName?: string;
}

export function timeUntilStale(updatedAt: number, staleTime?: number): number {
  return Math.max(updatedAt + (staleTime || 0) - Date.now(), 0);
}

export function RefreshButton(props: {
  runButton: boolean;
  lastUpdated?: number;
  disabled?: boolean;
}) {
  const {
    widgetRef,
    widget: { type: widgetType, staleTime, id: widgetUUid } = {},
    updateWidget,
  } = useWidgetContext();

  const { runButton, lastUpdated, disabled = false } = props;

  const [state, dispatch] = useStateReducer({
    staleParams: widgetRef?.current?.storage?.ssrmDisabled,
    isStale: false,
    fromNow: lastUpdated && dayjs(lastUpdated).fromNow(),
    showStalePulse: !(isOmniType(widgetType) || isSSRMType(widgetType)),
  });
  const hadError = !(lastUpdated || state.staleParams);

  useEventListener(`staleParams-${widgetUUid}`, (data) => dispatch(data));

  useLayoutEffect(() => {
    if (!(lastUpdated && staleTime)) return;
    const timeUntil = timeUntilStale(lastUpdated, staleTime);
    dispatch({ fromNow: dayjs(lastUpdated).fromNow() });

    const isValidNum = Number.isFinite(timeUntil);

    const staleInterval = setInterval(() => {
      dispatch({ isStale: isValidNum });
      clearInterval(staleInterval);
    }, timeUntil + 1);

    const fromNowInterval = setInterval(() => {
      dispatch({ fromNow: dayjs(lastUpdated).fromNow() });
    }, 1000 * 60);

    return () => {
      if (!(lastUpdated && staleTime)) return;
      clearInterval(staleInterval);
      clearInterval(fromNowInterval);
      dispatch({ isStale: false });
    };
  }, [lastUpdated, staleTime]);

  const onClick = useCallback(() => {
    if (runButton) {
      dispatchRunParams(widgetUUid);
      if (!hadError) return;
    }
    updateWidget((prev) => ({ ...prev, refreshQuery: Date.now() }));
  }, [hadError, runButton, widgetUUid, updateWidget]);

  const tooltipMessage = useMemo(() => {
    const dataUpdateFooter = <DataUpdateTooltipFooter />;

    // runButton takes precedence - used by OmniWidget and AgGridSSRMAdvanced
    if (runButton) {
      return (
        <div>
          <div className="flex items-center gap-1">
            <span>Click to run</span>
          </div>
          {lastUpdated ? (
            <div className="text-light-500 text-xs">
              Last run: {dayjs(lastUpdated).format("MMM D, YYYY, h:mm A")}
            </div>
          ) : null}
          {dataUpdateFooter}
        </div>
      );
    }

    if (isSSRMType(widgetType)) {
      return (
        <div>
          <div className="flex items-center gap-1">
            <span>Click to refresh the table</span>
          </div>
          {dataUpdateFooter}
        </div>
      );
    }

    if (state.fromNow) {
      return (
        <div>
          <div className="flex items-center gap-1">
            <span>Last refresh {state.fromNow}</span>
          </div>
          <DataUpdateTooltipFooter lastUpdated={lastUpdated} />
        </div>
      );
    }

    if (hadError) {
      return (
        <div>
          <div className="flex items-center gap-1">
            <span>Click to retry</span>
          </div>
          {dataUpdateFooter}
        </div>
      );
    }

    return <DataUpdateTooltipFooter showDivider={false} />;
  }, [widgetType, runButton, lastUpdated, state.fromNow, hadError]);

  const isMobile = useIsMobile();

  return (
    <Tooltip message={tooltipMessage} hide={isMobile}>
      {runButton ? (
        <button
          className={cn("size-[18px] obb-small-navbar-btn", {
            "opacity-40 cursor-not-allowed": disabled,
            "pulse-box-shadow": state.staleParams && state.showStalePulse,
          })}
          onClick={onClick}
          disabled={disabled}
        >
          <Icon id="play-square" className="size-3.5" />
        </button>
      ) : (
        <button className="obb-small-navbar-btn" onClick={onClick} disabled={disabled}>
          <Icon
            id="timer-icon"
            className={cn("h-4 w-4", {
              "text-light-500!": disabled,
              "text-[#5eb57f]": !(disabled || state.isStale || hadError),
              "text-[#c5804f]": !disabled && (state.isStale || hadError),
            })}
          />
        </button>
      )}
    </Tooltip>
  );
}
export function CopilotButton({ aiEnabled }: { aiEnabled?: boolean }) {
  const isMobile = useIsMobile();
  const { widgetRef, isPreview } = useWidgetContext();

  const widgetDashboardSelectFF = useShallowCopilotStore((s) =>
    Boolean(s.selectedCopilot?.features?.["widget-dashboard-select"]),
  );

  // Get disableRetrievalForCopilot from the widget
  const disableRetrievalForCopilot = widgetRef?.current?.disableRetrievalForCopilot;
  const disabled = !aiEnabled || disableRetrievalForCopilot || isPreview;

  // Update contextEnabled to also check for disableRetrievalForCopilot
  const contextEnabled = widgetDashboardSelectFF && !disabled;

  const tooltipMessage = useMemo(() => {
    if (isPreview) return "Copilot is not available in preview mode.";
    if (disabled) return "Copilot is not allowed to retrieve data from this widget.";

    return widgetDashboardSelectFF
      ? "Add widget as context to the Copilot for customized answers using its data."
      : "Dashboard widget selection is not enabled for this copilot.";
  }, [widgetDashboardSelectFF, disabled, isPreview]);

  const { isSelected, toggleSelectedWidget, getDashboardWidgetData } =
    useShallowCopilotDataStore((state) => ({
      isSelected: state?.isWidgetSelected(widgetRef.current?.id) ?? false,
      toggleSelectedWidget: state?.toggleSelectedWidget,
      getDashboardWidgetData: state?.getDashboardWidgetData,
    }));
  const { addAction } = useShallowCopilotStore((s) => ({
    addAction: s.addAction,
  }));
  const preventDragStart = useCallback((e) => e.stopPropagation(), []);

  const selectWidget = useCallback(() => {
    const widget = widgetRef.current;
    if (widget?.id) {
      const aiData = getDashboardWidgetData(widget?.id)?.data || [];
      const columnCount = Object.keys(aiData?.[0] || {}).length;

      if (columnCount * aiData?.length > TOTAL_CELL_LIMIT)
        return showNotification({
          message: "Widget Data Too Large",
          description: `The widget data is too large to be used as context.
          Please reduce the number of rows or columns in the widget.`,
          toastType: "error",
        });

      toggleSelectedWidget(widget.id);
      if (isSelected) {
        addAction(`Removed widget ${widget.id} from explicit context`);
      } else {
        addAction(`Added widget ${widget.id} to explicit context`);
      }
      if (posthog) {
        const fileType =
          widget?.connectionType === "file" && widget?.endpoint?.url?.split(".").pop();
        const fileExtension = fileType ? `.${fileType}` : "";
        let eventName = "added_widget_as_context";
        if (fileExtension) {
          if (fileExtension === ".pdf") eventName = "added_pdf_as_context";
          else if (IMAGE_FILE_EXTENSIONS.includes(fileExtension))
            eventName = "added_image_as_context";
        }

        posthog.capture(eventName, {
          widget_name: widget?.widgetId,
          widget_external: widget?.external,
          widget_type: widget?.type,
        });
      }
    }
  }, [widgetRef, toggleSelectedWidget, getDashboardWidgetData, isSelected, addAction]);

  return useMemo(
    () => (
      <Tooltip message={tooltipMessage} hide={isMobile}>
        <button
          className={cn("obb-small-navbar-btn", {
            "pulse-box-shadow bg-brand-main! text-white": isSelected,
          })}
          onClick={selectWidget}
          onMouseDown={preventDragStart} // Prevent dragging when this button is used
          onTouchStart={preventDragStart} // For touch devices
          disabled={disabled || !contextEnabled}
        >
          <Icon
            id={`message-plus${disabled ? "-square" : ""}`}
            className={disabled && "text-light-300 dark:text-dark-300"}
          />
        </button>
      </Tooltip>
    ),
    [disabled, isSelected, selectWidget, tooltipMessage, contextEnabled],
  );
}

const widgetDescriptionRegex = /database.*|snowflake.*|file-.*|rich_note/;

const DefaultSettings = {
  showMetadata: true,
  showSettings: true,
  showFunctions: true,
  showParameters: true,
  showShare: true,
  showDuplicate: true,
  showExport: true,
  showMaximize: true,
  showMove: true,
  showSchema: true,
  showCopyToClipboard: false,
} as const;

const ValidWidgetIds = [
  "iframe",
  "youtube",
  "rich_note",
  "rss_viewer",
  "ag_grid_file",
  "copilot_table",
  "ag_chart",
  "ag_chart_from_table",
];
const ValidConnectionTypes = ["single", "snowflake", "database"];

const showMinimizeWidgetFF = getConfig().ui.showMinimizeWidget;

function onWidgetMinimized(isMinimized: boolean, widgetId: string) {
  const elements = document.querySelectorAll(
    `[data-widget-id='${widgetId}'] .react-resizable-handler`,
  ) as NodeListOf<HTMLElement>;
  for (const element of elements) {
    if (element?.style) element.style.display = isMinimized ? "none" : "block";
  }
}

const DataUpdateTooltipFooter = memo(
  ({
    lastUpdated,
    showDivider = true,
  }: {
    lastUpdated?: number;
    showDivider?: boolean;
  }) => {
    const schedule = useWidgetContext().widget?.dataUpdateDisplay;

    const { lastUpdate, nextUpdate, description, isValid } = useMemo(() => {
      if (!schedule) return {};

      const lastUpdate = getPreviousCronDate(schedule);
      const nextUpdate = getNextCronDate(schedule);
      const description = describeCronExpression(schedule);
      const isValid = Boolean(description);
      return { lastUpdate, nextUpdate, description, isValid };
    }, [schedule]);

    if (!schedule)
      return (
        lastUpdated && (
          <div className="text-light-500 text-xs">
            {dayjs(lastUpdated).format("MMM D, YYYY, h:mm A")}
          </div>
        )
      );

    return (
      <>
        {showDivider ? <hr className="border-general-border-primary my-2" /> : null}
        <div className="text-[11px] leading-[16px] min-w-[240px]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold text-ds-text-heading">Data update</div>
              <div className="text-ds-text-caption mt-0.5">Scheduled data update</div>
            </div>
            <span
              className="inline-flex items-center gap-1 rounded-full bg-tag-grey-bg px-2 py-0.5
            text-[10px] font-medium text-tag-grey-label whitespace-nowrap shrink-0"
            >
              {description ?? "Invalid schedule"}
            </span>
          </div>
          <div className="flex justify-between gap-4 text-ds-text-caption mt-2">
            <span className="inline-flex items-center gap-1">
              <Icon id="clock-icon" className="size-3" />
              Last update
            </span>
            <span className="font-medium text-ds-text-heading">
              {lastUpdate
                ? dayjs(lastUpdate).format("MMM D, h:mm A")
                : isValid
                  ? "N/A"
                  : "Invalid"}
            </span>
          </div>
          <div className="flex justify-between gap-4 text-ds-text-caption mt-1">
            <span className="inline-flex items-center gap-1">
              <Icon id="refresh-icon" className="size-3" />
              Next update
            </span>
            <span className="font-medium text-ds-text-heading">
              {nextUpdate ? dayjs(nextUpdate).format("MMM D, h:mm A") : "Invalid"}
            </span>
          </div>
        </div>
      </>
    );
  },
);

// Overflow detection thresholds for collapsible navbar controls
const COLLAPSE_THRESHOLD = 20; // Collapse when middle spacer gets this small (px)
const EXPAND_THRESHOLD = 150; // Must be larger than controls width (~100px) to prevent flicker

const NavBar = forwardRef<HTMLDivElement, NavBarProps>(
  (props: NavBarProps, _ref: Ref<HTMLDivElement>) => {
    const {
      isPreview: propIsPreview = false,
      aiEnabled = false,
      showAIContextButton = true,
      lastUpdated,
      title,
      tooltipMessage,
      navbarClassName = "",
      elementRightNextToTitle,
      elementLeftOfTitle,
      elementNextToTitle,
      elementBelowTitle,
      extraNavbarElements,
      prependNavbarElements,
      loading = false,
      showClose = true,
      showEllipsisMenu = true,
      onSaveSettings = () => {},
      extraSettings = [],
      exportFns = {},
      settingsModalChildren = null,
      onClose,
      showActionsSettings = false,
      extraActions = null,
      openSettings = false,
      setOpenSettings,
      settingsDialogClassName,
      refreshButtonType = "timer",
      elementBelowNavbar,
    } = props;

    const settings = useMemo(() => {
      if (!props.settings) return DefaultSettings;
      if (props.settings.overrideSettings !== false) return props.settings;

      return {
        ...DefaultSettings,
        ...props.settings,
      };
    }, [Object.values(props.settings || {})]);

    const {
      widgetRef,
      widgetFromJSON,
      activeDashboardId,
      updateWidget,
      isShared,
      isPreview: contextIsPreview,
    } = useWidgetContext();

    // Use context isPreview if available, otherwise fall back to prop
    const isPreview = contextIsPreview ?? propIsPreview;

    const copilotAvailable = useCopilotAvailable();

    const [state, dispatch] = useStateReducer({
      ...initialState,
      isMinimized: widgetRef?.current?.isMinimized,
      controlsExpanded: false,
      controlsHovered: false,
      shouldCollapseFromOverflow: false,
    });

    const isMinimizedRef = useRef<boolean>(state.isMinimized);

    // Ref for overflow detection - measure the middle spacer
    const middleSpacerRef = useRef<HTMLDivElement>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);

    const isResizing = useShallowThemeStore(
      (state) => state.isResizingGridElement === widgetRef?.current?.id,
    );

    useEffect(() => {
      if (isResizing) {
        isMinimizedRef.current = false;
        updateWidget((prev) => ({ ...prev, isMinimized: false }));
        dispatch({ isMinimized: false });
      }
      onWidgetMinimized(state.isMinimized, widgetRef?.current?.id);
    }, [isResizing]);

    const { removeWidget, minimizeWidget } = useShallowAppStore((state) => ({
      removeWidget: state.removeWidget,
      minimizeWidget: state.minimizeWidget,
    }));

    const preventDragStart = useCallback((e) => {
      e.stopPropagation();
    }, []);

    const isSelected = useShallowCopilotDataStore(
      (state) => state?.isWidgetSelected(widgetRef?.current?.id) ?? false,
    );

    const { showWidgetControlsEllipsis, showMinimizeButton } = useShallowThemeStore(
      (state) => ({
        showWidgetControlsEllipsis: state.showWidgetControlsEllipsis,
        showMinimizeButton: state.showMinimizeButton,
      }),
    );

    const isMobile = useIsMobile();
    const shouldShowMinimizeButton = showMinimizeWidgetFF && showMinimizeButton;

    // Overflow detection with hysteresis to prevent flickering
    const isCollapsedRef = useRef(false);

    // Set up ResizeObserver when component mounts and cleanup on unmount
    useLayoutEffect(() => {
      // Clean up existing observer
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }

      // Early return if overflow detection is disabled
      if (showWidgetControlsEllipsis) return;

      const element = middleSpacerRef.current;
      if (!element) return;

      const checkOverflow = () => {
        const spacerWidth = element.clientWidth;

        let shouldCollapse = isCollapsedRef.current;

        if (isCollapsedRef.current) {
          // Currently collapsed - only expand if there's plenty of room
          if (spacerWidth >= EXPAND_THRESHOLD) {
            shouldCollapse = false;
          }
        } else if (spacerWidth <= COLLAPSE_THRESHOLD) {
          // Currently expanded - collapse if space is tight
          shouldCollapse = true;
        }

        if (shouldCollapse !== isCollapsedRef.current) {
          isCollapsedRef.current = shouldCollapse;
          dispatch({ shouldCollapseFromOverflow: shouldCollapse });
        }
      };

      const resizeObserver = new ResizeObserver(checkOverflow);
      resizeObserver.observe(element);
      checkOverflow();
      resizeObserverRef.current = resizeObserver;

      return () => {
        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect();
          resizeObserverRef.current = null;
        }
      };
    }, [showWidgetControlsEllipsis, dispatch]);

    const cleanWidgetId = useMemo(() => {
      const { connectionType, widgetId = "" } = widgetRef.current || {};
      return getCleanWidgetId(widgetId, connectionType);
    }, [widgetRef]);

    const { name, source, description, category, subCategory, backend } =
      useMemo(() => {
        const widget = widgetRef?.current;
        const widgetSource = getWidgetDataSource(widget)?.toString();
        let source = widgetSource || widgetFromJSON?.source || widget?.source;

        // For copilot_table widgets, clear the source to avoid showing "OpenBB Workspace" in top right
        if (widget?.widgetId?.startsWith("copilot_table")) {
          source = "";
        }

        const description = widgetDescriptionRegex.test(widget?.widgetId || "")
          ? widget?.description
          : widgetFromJSON?.description || widget?.description || "";

        let backend: string;
        if (
          widget?.widgetId?.startsWith("rich_note") ||
          widget?.widgetId === "rss_viewer" ||
          widget?.widgetId === "ag_grid_file" ||
          widget?.widgetId?.startsWith("copilot_table") ||
          widget?.widgetId === "iframe"
        ) {
          backend = "OpenBB Workspace";
        } else {
          backend = widget?.external
            ? widget?.connectionType === "advanced-backend"
              ? widget?.sourceName || "Unknown"
              : "OpenBB API"
            : "OpenBB Sandbox";
        }

        const category = widget?.category || widgetFromJSON?.category;
        const subCategory = widget?.subCategory || widgetFromJSON?.subCategory;

        const name = title || widget?.name || widgetFromJSON?.name;

        return {
          name,
          source,
          description,
          category,
          subCategory,
          backend,
        };
      }, [
        widgetRef,
        getWidgetInfo(widgetRef?.current),
        widgetFromJSON,
        widgetRef?.current?.data?.mainTicker?.exchange,
      ]);

    const createdAt = widgetRef?.current?.storage?.createdAt;
    const lastEdited = widgetRef?.current?.storage?.lastEdited;

    const handleSettingsModal = useCallback(
      (value: boolean) => {
        dispatch({ settingsModal: value });
        setOpenSettings?.(value);
      },
      [setOpenSettings],
    );

    const handleMetadataModal = useCallback(
      (value: boolean) => {
        dispatch({ metadataModal: value });
      },
      [dispatch],
    );

    const handleClose = useCallback(
      (_e: any) => {
        if (!widgetRef?.current?.id) return;
        if (!activeDashboardId) return;
        if (isShared) return;

        const closeWidget = () => {
          const widgetClone = cloneDeep(widgetRef.current);

          onClose?.();
          removeWidget(activeDashboardId, widgetRef?.current?.id);

          showNotificationWithRememberMe({
            id: `${NotificationId.WidgetRemoved}:${widgetClone.id}`,
            message: "Widget Removed",
            description:
              "You can add the widget again by clicking on the plus icon on the bottom right corner of the screen.",
            toastType: "info",
            action: {
              label: "Undo",
              onClick: (dontShowAgain) => {
                if (dontShowAgain) return;
                // fixes validation issue with staleTime being 0
                if (widgetClone.staleTime === 0) widgetClone.staleTime = undefined;

                useAppStore.getState().addWidget(activeDashboardId, widgetClone);
              },
            },
            cancel: {
              label: "Close",
              onClick: () => {},
            },
          });
        };

        const { chartSettingsOpen, chartView } = widgetRef?.current?.storage || {};
        if (!(chartSettingsOpen && chartView?.enabled)) return closeWidget();

        toast.warning("Chart settings are open", {
          description: "Are you sure you want to close the widget?",
          action: {
            label: "Yes, Close",
            onClick: closeWidget,
          },
        });
      },
      [widgetRef, activeDashboardId, onClose],
    );

    const settingsChildren = useMemo(
      () => settingsModalChildren,
      [settingsModalChildren],
    );

    const ellipsisSettings = useMemo(() => {
      const hasFunctions =
        !widgetRef?.current?.external &&
        (widgetFromJSON?.excelDataFunction?.length > 0 ||
          widgetFromJSON?.platformDataFunction?.length > 0);
      const isOmniOrSSRMType =
        isSSRMType(widgetFromJSON?.type) || isOmniType(widgetFromJSON?.type);
      const output = {
        ...settings,
        showMetadata:
          //settings?.showMetadata !== undefined &&
          ValidWidgetIds.includes(cleanWidgetId) ||
          isOmniOrSSRMType ||
          // we enable metadata if its one of our widgets. this is a bit fragmented because in some
          // places we add the connectionType to widgetId, and others we actually have the connectionType key,
          // in the future we make sure we always have connectionType key
          ValidConnectionTypes.includes(widgetRef?.current?.connectionType),
        showSettings: settingsChildren === null ? false : settings.showSettings,
        showFunctions:
          settings?.showFunctions !== undefined && hasFunctions
            ? settings?.showFunctions
            : hasFunctions || widgetRef?.current?.external,
        showMinimize: shouldShowMinimizeButton,
      };

      if (inSnowflakeNativeApp) {
        output.showFunctions = false;
      }
      return output;
    }, [
      Object.values(settings || {}),
      settingsChildren === null,
      widgetRef,
      widgetFromJSON,
      cleanWidgetId,
      shouldShowMinimizeButton,
    ]);

    const ellipsisExportFns = useMemo(() => {
      const widget = widgetRef?.current;
      return {
        ...exportFns,
        pngFunction: exportFns?.pngFunction
          ? exportFns?.pngFunction
          : widget?.id
            ? (title = "report") => {
                const element = document.getElementById(widget?.id);
                if (!element) return;

                const prevElementStyle = (element.cloneNode(true) as HTMLElement).style;
                element.style.overflow = "hidden";

                const prevChildrenStyles = [];
                const children = element.querySelectorAll(
                  "*",
                ) as NodeListOf<HTMLElement>;

                for (const child of children) {
                  prevChildrenStyles.push(child.style.overflow);
                  child.style.overflow = "hidden";
                }

                toPng(element, {})
                  .then((dataUrl) => {
                    const link = document.createElement("a");
                    link.download = `${title}.png`;
                    link.href = dataUrl;
                    link.click();
                    link.remove();
                  })
                  .finally(() => {
                    element.style.overflow = prevElementStyle.overflow;
                    for (const child of children) {
                      child.style.overflow = prevChildrenStyles.shift();
                    }
                  });
              }
            : null,
      };
    }, [Object.values(exportFns), widgetRef]);

    const { runButton, showLastUpdate } = useMemo(() => {
      const widget = widgetRef?.current;
      const runButton = refreshButtonType === "run" || widget?.runButton;
      const showLastUpdate =
        runButton ||
        Boolean(widget?.dataUpdateDisplay) ||
        ![0, undefined].includes(lastUpdated);
      return {
        runButton,
        showLastUpdate: showLastUpdate || isSSRMType(widgetFromJSON?.type),
      };
    }, [refreshButtonType, lastUpdated, widgetRef, widgetFromJSON?.type]);

    const handleMinimizeWidget = useCallback(() => {
      if (!widgetRef?.current?.id) return;
      if (!activeDashboardId) return;
      if (isShared) return;

      const newMinimizedState = !isMinimizedRef.current;
      isMinimizedRef.current = newMinimizedState;

      // Call the function to update the widget height
      minimizeWidget(
        activeDashboardId,
        widgetRef.current.id,
        newMinimizedState,
        widgetRef?.current?.originalH,
      );
      dispatch({ isMinimized: newMinimizedState });
      onWidgetMinimized(newMinimizedState, widgetRef.current.id);
    }, [widgetRef, activeDashboardId, isShared, isMinimizedRef]);

    const elementBeforeTitle = useMemo(() => {
      if (props.elementBeforeTitle) return props.elementBeforeTitle;
      if (!widgetFromJSON.external) return null;
      const isOmniWidget = isOmniType(widgetFromJSON?.type);
      const params = (widgetFromJSON?.params ?? []).filter(
        (p) =>
          p.type !== "form" &&
          !(isOmniWidget && p.paramName === "prompt") &&
          !(p.paramName === "query" && isSSRMType(widgetFromJSON?.type)) &&
          !(p.type === "endpoint" && p.roles?.includes("fileSelector")),
      );

      const paramGroups = widgetRef?.current?.paramGroups ?? {};
      const badgeParams = new Set(
        getCellOnClickParams(widgetFromJSON).concat(
          Object.keys(paramGroups).filter((groupId) => paramGroups[groupId]),
        ),
      );
      const isBadgeParam = (param: (typeof params)[number]) =>
        badgeParams.has(param.paramName) ||
        (param.type === "endpoint" && badgeParams.has(param.groupById));
      const row0ParamsRenderedBySharedRenderer =
        isValidElement<{ "data-widget-param-row"?: string }>(elementRightNextToTitle) &&
        elementRightNextToTitle.props?.["data-widget-param-row"] === "0";
      const paramsForFallback = row0ParamsRenderedBySharedRenderer
        ? params.filter((param) => !isBadgeParam(param))
        : params;

      // Render one badge per hidden param that belongs to a group or cellOnClick groupBy target.
      const hiddenBadgeParams = paramsForFallback.filter(
        (p) => (p.row ?? 0) === 0 && !p.show && isBadgeParam(p),
      );

      if (hiddenBadgeParams.length > 0) {
        return hiddenBadgeParams.map((param) => (
          <GroupDropdown key={param.paramName} className="" paramDef={param} />
        ));
      }

      const endpointParam = paramsForFallback.find(
        (p) => (p.row ?? 0) === 0 && p.type === "endpoint" && !p.show,
      );
      const allHidden =
        paramsForFallback.length > 0 && paramsForFallback.every((p) => !p.show);

      if (endpointParam) {
        return <GroupDropdown className="" paramDef={endpointParam} />;
      }

      if (allHidden) {
        const firstParam = paramsForFallback.find((p) => (p.row ?? 0) === 0);
        if (!firstParam) return null;
        return <GroupDropdown className="" paramDef={firstParam} />;
      }

      return null;
    }, [
      widgetFromJSON.params,
      widgetFromJSON?.data?.table?.columnsDefs,
      elementRightNextToTitle,
      props.elementBeforeTitle,
    ]);

    const onMouseOver = useCallback(
      (controlsHovered: boolean) => () => dispatch({ controlsHovered }),
      [],
    );

    const [controlsHovered] = useDebounceValue(state.controlsHovered, 500);

    // Collapse when setting is ON, or when overflow is detected (setting OFF)
    const shouldCollapse =
      showWidgetControlsEllipsis || state.shouldCollapseFromOverflow;

    // Lock controls open when widget is selected or has an active control (chart view, editor)
    const hasActiveControl =
      isSelected ||
      !!widgetRef?.current?.storage?.chartView?.enabled ||
      !!widgetRef?.current?.storage?.isEditorExpanded;
    const autoLocked = shouldCollapse && hasActiveControl;
    const controlsVisible =
      state.controlsHovered || state.controlsExpanded || controlsHovered || autoLocked;

    const showCopilotButton = showAIContextButton && copilotAvailable;

    return (
      <>
        <div
          className={cn("flex flex-col items-center justify-between", navbarClassName, {
            "mb-1": !elementBelowNavbar,
          })}
        >
          <div
            className={cn("flex w-full items-center overflow-hidden", {
              "mb-1": !elementBelowNavbar,
            })}
          >
            <div
              className={cn(
                "flex items-center gap-2 _left-navbar min-w-0 overflow-hidden",
                { "pb-2 pl-2.5 pt-2": name, "h-[18px] p-0": !name },
              )}
            >
              {showLastUpdate && (
                <div className="flex-shrink-0">
                  <RefreshButton
                    runButton={runButton}
                    lastUpdated={lastUpdated}
                    disabled={loading}
                  />
                </div>
              )}
              {elementLeftOfTitle && (
                <div className="flex flex-shrink-0 items-center">
                  {elementLeftOfTitle}
                </div>
              )}
              <div
                className={cn(
                  "flex items-center gap-2 min-w-0",
                  isMobile ? "overflow-x-auto" : "overflow-hidden",
                )}
              >
                <div
                  className={cn(
                    "inherit draggable-handle flex items-center gap-1 flex-shrink-0",
                    { "md:cursor-move": !isShared },
                  )}
                >
                  <Tooltip
                    message={
                      title ? (
                        <div className="max-w-[296px]">
                          <div className="flex justify-between items-center gap-2 mb-2.5 min-w-0">
                            <Tooltip message={backend} position="top">
                              <div className="bg-[rgba(188,188,188,0.3)] dark:bg-[rgba(90,89,97,0.3)] rounded-xl min-w-0 max-w-[140px]">
                                <div className="px-1.5 py-0">
                                  <span className="block truncate whitespace-nowrap text-2xs leading-[1.5] text-[#717177] dark:text-[#b8b9bc]">
                                    {backend}
                                  </span>
                                </div>
                              </div>
                            </Tooltip>
                            {source && (
                              <Tooltip message={source} position="top">
                                <span className="block truncate whitespace-nowrap min-w-0 max-w-[140px] text-2xs leading-[1.5] text-[#6d6e74] dark:text-[#8a8a90]">
                                  {source}
                                </span>
                              </Tooltip>
                            )}
                          </div>

                          <div className="font-bold text-[12px] leading-[18px] text-[#070707] dark:text-white mb-2">
                            {title}
                          </div>

                          <hr className="border-[#EBEBED] dark:border-[#454550] mb-2" />

                          {category && (
                            <div className="text-2xs leading-[1.5] text-[#6d6e74] dark:text-[#8a8a90] mb-1">
                              {[category, subCategory].filter(Boolean).join(" • ") ||
                                ""}
                            </div>
                          )}

                          {description && (
                            <div className="text-[12px] leading-[18px] text-[#151518] dark:text-white  max-h-[200px] overflow-y-auto">
                              {linkifyText(description)}
                            </div>
                          )}

                          {(createdAt || lastEdited) && (
                            <div className="mt-2 text-2xs leading-[1.5] text-[#6d6e74] dark:text-[#8a8a90]">
                              {createdAt && (
                                <div>
                                  Created:{" "}
                                  {dayjs(createdAt).format("MMM D, YYYY, h:mm A")}
                                </div>
                              )}
                              {lastEdited && (
                                <div>
                                  Last edited:{" "}
                                  {dayjs(lastEdited).format("MMM D, YYYY, h:mm A")}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span>{linkifyText(description)}</span>
                      )
                    }
                  >
                    <p className="font-semibold relative whitespace-nowrap">{name}</p>
                  </Tooltip>
                </div>
                {tooltipMessage && (
                  <div className="flex items-start pb-1 flex-shrink-0">
                    <Tooltip message={tooltipMessage}>
                      <InfoCircledIcon className="h-4 w-4 text-light-600" />
                    </Tooltip>
                  </div>
                )}
                {(elementBeforeTitle ||
                  elementRightNextToTitle ||
                  elementNextToTitle) && (
                  <div
                    className={cn(
                      "flex items-center gap-2",
                      isMobile ? "flex-shrink-0" : "overflow-x-auto min-w-0 flex-1",
                    )}
                  >
                    {elementBeforeTitle && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {elementBeforeTitle}
                      </div>
                    )}
                    <div
                      className={cn(
                        "flex gap-1 _elements-left-navbar items-center overflow-y-hidden",
                        isMobile ? "flex-shrink-0" : "shrink min-w-0",
                      )}
                    >
                      {elementRightNextToTitle}
                      {elementNextToTitle}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div
              ref={middleSpacerRef}
              className={cn(
                "draggable-handle mx-0.5 h-[20px] min-w-[10px] flex-1 _middle-navbar",
                { "md:cursor-move": !isShared },
              )}
            />
            <div
              className={cn(
                "flex items-start gap-2 p-1 mr-1 text-light-500 _right-navbar relative flex-shrink-0 rounded-sm",
                {
                  "bg-general-bg-secondary": state.controlsExpanded,
                },
              )}
              onMouseEnter={shouldCollapse ? onMouseOver(true) : undefined}
              onMouseLeave={shouldCollapse ? onMouseOver(false) : undefined}
            >
              <div
                data-testid="_navbar-controls-left"
                data-collapsed={!isMobile && shouldCollapse && !controlsVisible}
                className={cn("flex items-center gap-2 transition-all duration-200", {
                  "w-0 overflow-hidden opacity-0":
                    !isMobile && shouldCollapse && !controlsVisible,
                  "w-auto opacity-100": isMobile || !shouldCollapse || controlsVisible,
                })}
              >
                {prependNavbarElements}

                {showCopilotButton && <CopilotButton aiEnabled={aiEnabled} />}

                {extraNavbarElements}
              </div>
              {state.isFullscreen && (
                <WidgetFullscreen
                  widgetId={widgetRef?.current?.id}
                  open={state.isFullscreen}
                  setOpen={(value: boolean) => dispatch({ isFullscreen: value })}
                  header={
                    <div className="flex items-center gap-2">
                      <p className="whitespace-nowrap font-semibold">{name}</p>
                      {tooltipMessage && (
                        <Tooltip message={tooltipMessage}>
                          <InfoCircledIcon className="h-4 w-4 text-light-600" />
                        </Tooltip>
                      )}
                    </div>
                  }
                  //children={children}
                />
              )}
              {state.metadataModal && (
                <MetadataDialog
                  open={state.metadataModal || openSettings}
                  setOpen={handleMetadataModal}
                  className={settingsDialogClassName}
                />
              )}
              {(state.settingsModal || openSettings) && (
                <SettingsDialog
                  open={state.settingsModal || openSettings}
                  setOpen={handleSettingsModal}
                  title={name}
                  children={settingsChildren}
                  showActionsSettings={showActionsSettings}
                  extraActions={extraActions}
                  onSubmit={onSaveSettings}
                  className={settingsDialogClassName}
                />
              )}
              {state.functionsModal && (
                <FunctionsDialog
                  open={state.functionsModal}
                  setOpen={(value: boolean) => dispatch({ functionsModal: value })}
                  // @ts-expect-error - ignored for now
                  title={name}
                />
              )}
              {!isMobile && (
                <div
                  data-testid="_navbar-controls-right"
                  data-collapsed={shouldCollapse && !controlsVisible}
                  className={cn("flex items-center gap-2 transition-all duration-200", {
                    "w-0 overflow-hidden opacity-0": shouldCollapse && !controlsVisible,
                    "w-auto opacity-100": !shouldCollapse || controlsVisible,
                  })}
                >
                  {state.parametersModal && (
                    <ParametersDialog
                      open={state.parametersModal}
                      setOpen={(value: boolean) => dispatch({ parametersModal: value })}
                    />
                  )}
                  {showEllipsisMenu && (
                    <EllipsisDropdownMenu
                      dispatch={dispatch}
                      settings={ellipsisSettings}
                      extraSettings={extraSettings}
                      exportFns={ellipsisExportFns}
                      isMinimized={state.isMinimized}
                      onMinimizeToggle={handleMinimizeWidget}
                    />
                  )}
                </div>
              )}

              {!isMobile && isSelected && shouldCollapse && !controlsVisible && (
                <div className="flex items-center gap-2 transition-all duration-200">
                  <CopilotButton aiEnabled={aiEnabled} />
                </div>
              )}
              {!isMobile && shouldCollapse && (
                <button
                  className={cn(
                    "obb-small-navbar-btn flex items-center justify-center",
                    {
                      "bg-brand-main! hover:bg-brand-main!": state.controlsExpanded,
                    },
                  )}
                  onClick={() => dispatch({ controlsExpanded: (prev) => !prev })}
                  onMouseDown={preventDragStart}
                  onTouchStart={preventDragStart}
                >
                  <Icon
                    id="chevrons-left"
                    className={cn("w-4 h-4", {
                      "text-white": state.controlsExpanded,
                      "dark:text-light-100 text-light-600": !state.controlsExpanded,
                    })}
                  />
                </button>
              )}
              {isMobile && showEllipsisMenu && (
                <EllipsisDropdownMenu
                  dispatch={dispatch}
                  settings={ellipsisSettings}
                  extraSettings={extraSettings}
                  exportFns={ellipsisExportFns}
                  isMinimized={state.isMinimized}
                  onMinimizeToggle={handleMinimizeWidget}
                />
              )}
              {showClose && (
                <Tooltip
                  message={
                    isShared || isPreview
                      ? "You can't remove this widget"
                      : "This widget will be removed from the dashboard"
                  }
                >
                  <button
                    id={`close-widget-${widgetRef.current?.id}`}
                    disabled={isShared || isPreview}
                    onClick={handleClose}
                    onMouseDown={preventDragStart} // Prevent dragging when this button is used
                    onTouchStart={preventDragStart} // For touch devices
                    className={cn(
                      "ignore-select-widget obb-small-navbar-btn relative",
                      { "opacity-40 cursor-not-allowed": isShared },
                    )}
                  >
                    <Icon id="cross-icon" className="w-4 h-4" />
                  </button>
                </Tooltip>
              )}
            </div>
          </div>
          {elementBelowTitle}
        </div>
        {elementBelowNavbar && (
          <div className={cn({ hidden: state.isMinimized })}>{elementBelowNavbar}</div>
        )}
      </>
    );
  },
);

export default memo(NavBar);
